import { Cart, LogMessage, Order, Transaction } from "common/types";
import { app } from "../..";
import { parseJWT, verifyJWT } from "../../util/jwt";
import { BitsTransactionPayload } from "../../types";
import { getConfig } from "../config";
import { createOrder, getOrder, saveOrder } from "../../util/db";
import { sendToLogger } from "../../util/logger";
import { connection } from "../game";
import { TwitchUser } from "../game/messages";
import { asyncCatch } from "../../util/middleware";
import { sendShock } from "../../util/pishock";
import { getTwitchUser } from "../twitch";
import { validatePrepurchase } from "./order";

require('./user');

app.post(
    "/public/prepurchase",
    asyncCatch(async (req, res) => {
        const cart = req.body as Cart;
        const userId = req.user.id;
        
        const logContext: LogMessage = {
            transactionToken: null,
            userIdInsecure: userId,
            important: false,
            fields: [
                {
                    header: "",
                    content: "",
                },
            ],
        };
        const logMessage = logContext.fields[0];

        if (!connection.isConnected()) {
            res.status(502).send("Game connection is not available");
            return;
        }
        let order: Order;
        try {
            order = await createOrder(userId, { cart, state: -1 }); // OrderState.Rejected
        } catch (e: any) {
            logContext.important = true;
            logMessage.header = "Failed to register prepurchase";
            logMessage.content = { cart, userId, error: e };
            sendToLogger(logContext).then();
            throw e;
        }
        
        logMessage.header = "Created prepurchase";
        logMessage.content = { order };
        sendToLogger(logContext).then();

        let validationError: string | null;
        try {
            validationError = await validatePrepurchase(order);
        } catch (e: any) {
            res.status(500).send("Failed to register prepurchase");
            return;
        }
        if (typeof validationError === "string") {
            res.status(409).send(validationError);
            return;
        }

        order.state = 0;// OrderState.Prepurchase
        await saveOrder(order);
        res.status(200).send(order.id);
    })
);

app.post(
    "/public/transaction",
    asyncCatch(async (req, res) => {
        const transaction = req.body as Transaction;

        const logContext: LogMessage = {
            transactionToken: transaction.token,
            userIdInsecure: req.user.id,
            important: true,
            fields: [
                {
                    header: "",
                    content: "",
                },
            ],
        };
        const logMessage = logContext.fields[0];

        if (!transaction.receipt) {
            logMessage.header = "Missing receipt";
            logMessage.content = transaction;
            sendToLogger(logContext).then();
            res.status(400).send("Missing receipt");
            return;
        }

        if (!verifyJWT(transaction.receipt)) {
            logMessage.header = "Invalid receipt";
            logMessage.content = transaction;
            sendToLogger(logContext).then();
            res.status(403).send("Invalid receipt.");
            return;
        }

        const payload = parseJWT(transaction.receipt) as BitsTransactionPayload;

        if (!payload.data.transactionId) {
            logMessage.header = "Missing transaction ID";
            logMessage.content = transaction;
            sendToLogger(logContext).then();
            res.status(400).send("Missing transaction ID");
            return;
        }
        let order: Order | null;
        try {
            order = await getOrder(transaction.token);
        } catch (e: any) {
            logContext.important = true;
            logMessage.header = "Failed to get order";
            logMessage.content = {
                transaction: transaction,
                error: e,
            };
            sendToLogger(logContext).then();
            res.status(500).send("Failed to get transaction");
            return;
        }
        if (!order) {
            logMessage.header = "Transaction not found";
            logMessage.content = transaction;
            sendToLogger(logContext).then();
            res.status(404).send("Transaction not found");
            return;
        }
        if (order.state > 0) { // OrderState.Prepurchase
            logMessage.header = "Transaction already processed";
            logMessage.content = transaction;
            sendToLogger(logContext).then();
            res.status(409).send("Transaction already processed");
            return;
        }

        if (!order.cart) {
            logMessage.header = "Invalid transaction token";
            logMessage.content = transaction;
            sendToLogger(logContext).then();
            res.status(404).send("Invalid transaction token");
            return;
        }

        order.state = 2; // OrderState.Paid
        order.receipt = transaction.receipt;
        await saveOrder(order);

        if (order.userId != req.user.id) {
            // paying for somebody else, how generous
            logContext.important = true;
            logMessage.header = "Mismatched user ID";
            logMessage.content = {
                user: req.user,
                order,
                transaction,
            };
            sendToLogger(logContext).then();
        }

        const currentConfig = await getConfig();
        if (order.cart.version != currentConfig.version) {
            logContext.important = true;
            logMessage.header = "Mismatched config version";
            logMessage.content = {
                config: currentConfig.version,
                order,
                transaction: transaction,
            };
            sendToLogger(logContext).then();
        }

        console.log(transaction);
        console.log(order.cart);

        const redeem = currentConfig.redeems?.[order.cart.id];
        if (!redeem) {
            logContext.important = true;
            logMessage.header = "Redeem not found";
            logMessage.content = {
                configVersion: currentConfig.version,
                order,
            };
            sendToLogger(logContext).then();
            res.status(500).send("Redeem could not be found");
            return;
        }

        let userInfo: TwitchUser | null;
        try {
            userInfo = await getTwitchUser(order.userId);
        } catch (error) {
            userInfo = null;
            console.log(`Error while trying to get Twitch user info: ${error}`);
        }
        if (!userInfo) {
            logContext.important = true;
            logMessage.header = "Could not get Twitch user info";
            logMessage.content = {
                configVersion: currentConfig.version,
                order,
            };
            sendToLogger(logContext).then();
            // very much not ideal but they've already paid... so...
            userInfo = {
                id: order.userId,
                login: order.userId,
                displayName: order.userId,
            };
        }
        try {
            if (redeem.id == "redeem_pishock") {
                const success = await sendShock(50, 100);
                order.state = success
                    ? 4 // OrderState.Succeeded
                    : 3; // OrderState.Failed
                await saveOrder(order);
                if (success) {
                    res.status(200).send("Your transaction was successful!");
                } else {
                    res.status(500).send("Redeem failed");
                }
                return;
            }

            const resMsg = await connection.redeem(redeem, order, userInfo);
            order.state = resMsg.success
                ? 4 // OrderState.Succeeded
                : 3; // OrderState.Failed
            order.result = resMsg.message;
            await saveOrder(order);
            if (resMsg?.success) {
                console.log(`[${resMsg.guid}] Redeem succeeded: ${JSON.stringify(resMsg)}`);
                let msg = "Your transaction was successful! Your redeem will appear on stream soon.";
                if (resMsg.message) {
                    msg += "\n\n" + resMsg.message;
                }
                res.status(200).send(msg);
            } else {
                logContext.important = true;
                logMessage.header = "Redeem did not succeed";
                logMessage.content = resMsg;
                sendToLogger(logContext).then();
                res.status(500).send(resMsg?.message ?? "Redeem failed");
            }
        } catch (error) {
            logContext.important = true;
            logMessage.header = "Failed to send redeem";
            logMessage.content = {
                config: currentConfig.version,
                order,
                error,
            };
            sendToLogger(logContext).then();
            res.status(500).send(`Failed to process redeem - ${error}`);
        }
    })
);

app.post(
    "/public/transaction/cancel",
    asyncCatch(async (req, res) => {
        const guid = req.body.token as string;
        const logContext: LogMessage = {
            transactionToken: guid,
            userIdInsecure: req.user.id,
            important: true,
            fields: [
                {
                    header: "",
                    content: "",
                }
            ]
        };
        const logMessage = logContext.fields[0];

        try {
            const order = await getOrder(guid);

            if (!order) {
                res.status(404).send("Transaction not found");
                return;
            }

            if (order.userId != req.user.id) {
                logMessage.header = "Unauthorized transaction cancel";
                logMessage.content = {
                    order,
                    user: req.user,
                };
                sendToLogger(logContext);
                res.status(403).send("This transaction doesn't belong to you");
                return;
            }

            if (order.state > 0) { // OrderState.Prepurchase
                res.status(409).send("Cannot cancel this transaction");
                return;
            }

            order.state = 1; // OrderState.Cancelled
            await saveOrder(order);
            res.sendStatus(200);
        } catch (error) {
            logMessage.header = "Failed to cancel order";
            logMessage.content = error;
            sendToLogger(logContext).then();

            res.sendStatus(500);
        }
    })
);
