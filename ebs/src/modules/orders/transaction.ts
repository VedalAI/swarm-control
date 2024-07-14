import { Order, Transaction, User, OrderState, TransactionToken, TransactionTokenPayload, DecodedTransaction, BitsTransactionPayload } from "common/types";
import { verifyJWT, parseJWT } from "../../util/jwt";
import { getOrder, saveOrder } from "../../util/db";
import { ResultMessage } from "../game/messages.game";
import { HttpResult } from "../../types";

export const jwtExpirySeconds = 60;
const jwtExpiryToleranceSeconds = 15;
const defaultResult: HttpResult = { status: 403, message: "Invalid transaction" };

export function decodeJWTPayloads(transaction: Transaction): HttpResult | DecodedTransaction {
    if (!transaction.token || !verifyJWT(transaction.token)) {
        return { ...defaultResult, logHeaderOverride: "Invalid token" };
    }
    const token = parseJWT(transaction.token) as TransactionTokenPayload;
    if (!transaction.receipt || !verifyJWT(transaction.receipt)) {
        return { ...defaultResult, logHeaderOverride: "Invalid receipt" };
    }
    return {
        token,
        receipt: parseJWT(transaction.receipt) as BitsTransactionPayload,
    };
}

export function verifyTransaction(decoded: DecodedTransaction): HttpResult | TransactionToken {
    const token = decoded.token;

    // we don't care if our token JWT expired
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

    // we verified the receipt JWT earlier (in verifyTransaction)
    order.receipt = transaction.receipt;

    order.state = "paid";
    await saveOrder(order);

    return order;
}

export async function processRedeemResult(order: Order, result: ResultMessage): Promise<HttpResult> {
    order.state = result.success ? "succeeded" : "failed";
    order.result = result.message;
    await saveOrder(order);
    let msg = result.message;
    const res = { logContents: { order: order.id, cart: order.cart } };
    if (result.success) {
        console.log(`[${result.guid}] Redeem succeeded: ${JSON.stringify(result)}`);
        msg = "Your transaction was successful! Your redeem will appear on stream soon.";
        if (result.message) {
            msg += "\n\n" + result.message;
        }
        return { status: 200, message: msg, logHeaderOverride: "Redeem succeeded", ...res };
    } else {
        console.error(`[${result.guid}] Redeem failed: ${JSON.stringify(result)}`);
        msg ??= "Redeem failed.";
        return { status: 500, message: msg, logHeaderOverride: "Redeem failed", ...res };
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
        },
        product: { sku, cost },
    };
}

function getBitsPrice(sku: string) {
    // highly advanced pricing technology (all SKUs are in the form bitsXXX where XXX is the price)
    return parseInt(sku.substring(4));
}
