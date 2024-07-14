import { Order, Transaction, User, OrderState, TransactionToken, TransactionTokenPayload, DecodedTransaction, BitsTransactionPayload } from "common/types";
import { verifyJWT, parseJWT } from "../../util/jwt";
import { addCredit, getOrAddUser, getOrder, saveOrder } from "../../util/db";
import { ResultKind, ResultMessage } from "../game/messages.game";
import { sendToLogger } from "../../util/logger";
import { HttpResult } from "../../types";

export const jwtExpirySeconds = 60;
const jwtExpiryToleranceSeconds = 15;
const defaultResult: HttpResult = { status: 403, message: "Invalid transaction" };

export function decodeJWTPayloads(transaction: Transaction): HttpResult | DecodedTransaction {
    if (transaction.type !== "bits" && transaction.type !== "credit") {
        return { ...defaultResult, logHeaderOverride: "Invalid type" };
    }
    if (!transaction.token || !verifyJWT(transaction.token)) {
        return { ...defaultResult, logHeaderOverride: "Invalid token" };
    }
    const token = parseJWT(transaction.token) as TransactionTokenPayload;
    if (transaction.type === "bits") {
        if (!transaction.receipt || !verifyJWT(transaction.receipt)) {
            return { ...defaultResult, logHeaderOverride: "Invalid receipt" };
        }
        return {
            type: "bits",
            token,
            receipt: parseJWT(transaction.receipt) as BitsTransactionPayload,
        };
    }
    return {
        type: "credit",
        token,
    };
}

export function verifyTransaction(decoded: DecodedTransaction): HttpResult | TransactionToken {
    const token = decoded.token;

    if (decoded.type === "bits") {
        // for bits purchases, we don't care if our token JWT expired
        // because if the bits t/a is valid, the person paid and we have to honour it
        const receipt = decoded.receipt;
        if (receipt.topic != "bits_transaction_receipt") {
            // e.g. someone trying to put a token JWT in the receipt field
            return { ...defaultResult, logHeaderOverride: "Invalid receipt topic" };
        }
        if (receipt.exp < Date.now() / 1000 - jwtExpiryToleranceSeconds) {
            // status 403 and not 400 because bits JWTs have an expiry of 1 hour
            // if you're sending a transaction 1 hour after it happened... you're sus
            return { ...defaultResult, logHeaderOverride: "Bits receipt expired" };
        }
    } else if (decoded.type === "credit") {
        if (token.exp < Date.now() / 1000 - jwtExpiryToleranceSeconds) {
            return { ...defaultResult, status: 400, message: "Transaction expired, try again", logHeaderOverride: "Credit receipt expired" };
        }
    }

    return token.data;
}

export async function getAndCheckOrder(transaction: Transaction, decoded: DecodedTransaction, user: User): Promise<Order | HttpResult> {
    const token = verifyTransaction(decoded);
    if ("status" in token) {
        return token;
    }

    const orderMaybe = await getOrder(token.id);
    if (!orderMaybe) {
        return { status: 404, message: "Transaction not found" };
    }
    const order = orderMaybe;
    if (order.state != "prepurchase") {
        return { status: 409, message: "Transaction already processed" };
    }

    if (!order.cart) {
        return { status: 500, message: "Internal error", logHeaderOverride: "Missing cart", logContents: { order: order.id } };
    }
    if (order.cart.sku != token.product.sku) {
        return {
            status: 400,
            message: "Invalid transaction",
            logHeaderOverride: "SKU mismatch",
            logContents: { cartSku: order.cart.sku, tokenSku: token.product.sku },
        };
    }

    if (transaction.type === "credit") {
        const sku = order.cart.sku;
        const cost = getBitsPrice(sku);
        if (!isFinite(cost) || cost <= 0) {
            return { status: 500, message: "Internal configuration error", logHeaderOverride: "Bad SKU", logContents: { order: order.id, sku } };
        }
        if (user.credit < cost) {
            return {
                status: 409,
                message: "Insufficient credit",
                logContents: { user: user.id, order: order.id, cost, credit: user.credit },
            };
        }
        user = await addCredit(user, -cost);
        console.log(`Debited ${user.login ?? user.id} (${user.credit + cost} - ${cost} = ${user.credit})`);
        order.receipt = `credit (${user.credit + cost} - ${cost} = ${user.credit})`;
    } else {
        // for bits transactions, we verified the receipt JWT earlier (in verifyTransaction)
        order.receipt = transaction.receipt;
    }

    order.state = "paid";
    await saveOrder(order);

    return order;
}

const orderStateMap: { [k in ResultKind]: OrderState } = {
    success: "succeeded",
    error: "failed",
    deny: "denied",
};

export async function processRedeemResult(order: Order, result: ResultMessage): Promise<HttpResult> {
    order.state = orderStateMap[result.status];
    order.result = result.message;
    await saveOrder(order);
    let msg = result.message;
    const res = { logContents: { order: order.id, cart: order.cart } };
    if (result.status === "success") {
        console.log(`[${result.guid}] Redeem succeeded: ${JSON.stringify(result)}`);
        msg = "Your transaction was successful! Your redeem will appear on stream soon.";
        if (result.message) {
            msg += "\n\n" + result.message;
        }
        return { status: 200, message: msg, logHeaderOverride: "Redeem succeeded", ...res };
    } else {
        await refund(order);
        let status: number;
        let header: string;
        if (result.status === "deny") {
            status = 400;
            msg ??= "The game is not ready to process this redeem.";
            header = "Redeem denied";
        } else {
            status = 500;
            msg ??= "Redeem failed.";
            header = "Redeem failed";
        }
        console.error(`[${result.guid}] ${header}: ${JSON.stringify(result)}`);
        return { status: status, message: msg, logHeaderOverride: header, ...res };
    }
}

export async function refund(order: Order) {
    try {
        let user = await getOrAddUser(order.userId);
        const cost = parseInt(order.cart.sku.substring(4));
        user = await addCredit(user, cost);
        console.log(`Refunded ${user.login ?? user.id} (${user.credit - cost} + ${cost} = ${user.credit})`);
    } catch (e) {
        console.error(`Could not refund order ${order.id}`);
        console.error(e);
        sendToLogger({
            transactionToken: order.id,
            userIdInsecure: order.userId,
            important: true,
            fields: [{ header: "Failed to refund", content: { order: order.id, error: e } }],
        });
    }
}

export function makeTransactionToken(order: Order, user: User): TransactionToken {
    const sku = order.cart.sku;
    const cost = parseInt(sku.substring(4));
    if (!isFinite(cost) || cost <= 0) {
        throw new Error(`Bad SKU ${sku}`);
    }

    return {
        id: order.id,
        time: Date.now(),
        user: {
            id: user.id,
            credit: user.credit,
        },
        product: { sku, cost },
    };
}

function getBitsPrice(sku: string) {
    // highly advanced pricing technology (all SKUs are in the form bitsXXX where XXX is the price)
    return parseInt(sku.substring(4));
}
