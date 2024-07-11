import { Order, Transaction, User, OrderState } from "common/types";
import { BitsTransactionPayload } from "../../types";
import { verifyJWT, parseJWT } from "../../util/jwt";
import { getOrAddUser, getOrder, saveOrder, saveUser } from "../../util/db";
import { ResultKind, ResultMessage } from "../game/messages.game";
import { sendToLogger } from "../../util/logger";

type HttpResult = {
    status: number;
    message: string;
    logHeaderOverride?: string;
    logContents?: any;
};

export function checkBitsTransaction(transaction: Transaction): HttpResult | null {
    // bits transactions get verified earlier
    if (transaction.type === "bits") {
        if (!transaction.receipt) {
            return { status: 400, message: "Missing receipt" };
        }
        if (!verifyJWT(transaction.receipt)) {
            return { status: 403, message: "Invalid receipt" };
        }

        const payload = parseJWT(transaction.receipt) as BitsTransactionPayload;

        if (!payload.data.transactionId) {
            return { status: 400, message: "Missing transaction ID" };
        }
    } else if (transaction.type !== "credit" || transaction.receipt) {
        return { status: 400, message: "Invalid transaction" };
    }
    return null;
}

export async function getAndCheckOrder(transaction: Transaction, user: User): Promise<Order | HttpResult> {
    const orderMaybe = await getOrder(transaction.token);
    if (!orderMaybe) {
        return { status: 404, message: "Transaction not found" };
    }
    const order = orderMaybe;
    if (order.state != "prepurchase") {
        return { status: 409, message: "Transaction already processed" };
    }

    if (!order.cart) {
        return { status: 500, message: "Invalid transaction", logHeaderOverride: "Missing cart", logContents: { order: order.id } };
    }

    if (transaction.type === "credit") {
        const sku = order.cart.sku;
        const cost = parseInt(sku.substring(4)); // bitsXXX
        if (!isFinite(cost) || cost <= 0) {
            return { status: 500, message: "Invalid transaction", logHeaderOverride: "Bad SKU", logContents: { order: order.id, sku } };
        }
        if (user.credit < cost) {
            return {
                status: 409,
                message: "Insufficient credit",
                logHeaderOverride: "Insufficient credit",
                logContents: { user: user.id, order: order.id, cost, credit: user.credit },
            };
        }
        user.credit -= cost; // good thing node is single threaded :^)
        order.state = "paid";
        order.receipt = `credit (${user.credit + cost} - ${cost} = ${user.credit})`;
    } else {
        // for bits transactions, verifying the receipt JWT verifies the fact the person paid
        order.state = "paid";
        order.receipt = transaction.receipt;
    }

    await saveOrder(order);
    await saveUser(user);

    return order;
}

const orderStateMap: { [k in ResultKind]: OrderState } = {
    success: "succeeded",
    error: "failed",
    deny: "rejected",
};

export async function processRedeemResult(order: Order, result: ResultMessage): Promise<HttpResult> {
    order.state = orderStateMap[result.status];
    order.result = result.message;
    await saveOrder(order);
    if (result.status === "success") {
        console.log(`[${result.guid}] Redeem succeeded: ${JSON.stringify(result)}`);
        let msg = "Your transaction was successful! Your redeem will appear on stream soon.";
        if (result.message) {
            msg += "\n\n" + result.message;
        }
        return { status: 200, message: msg, logHeaderOverride: "Redeem succeeded", logContents: { order: order.id } };
    } else {
        await refund(order);
        return { status: 500, message: result.message ?? "Redeem failed", logHeaderOverride: "Redeem failed", logContents: { order: order.id } };
    }
}

export async function refund(order: Order) {
    try {
        let user = await getOrAddUser(order.userId);
        const cost = parseInt(order.cart.sku.substring(4));
        user.credit += cost;
        await saveUser(user);
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
