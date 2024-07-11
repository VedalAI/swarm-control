import { Cart, LogMessage, Transaction, Order } from "common/types";
import { app } from "../../..";
import { getConfig } from "../../config";
import { createOrder, getOrder, saveOrder, updateUserTwitchInfo } from "../../../util/db";
import { sendToLogger } from "../../../util/logger";
import { connection } from "../../game";
import { TwitchUser } from "../../game/messages";
import { asyncCatch } from "../../../util/middleware";
import { validatePrepurchase } from "../prepurchase";
import { setUserBanned } from "../../user";
import { checkBitsTransaction, getAndCheckOrder, processRedeemResult } from "../transaction";

app.post(
    "/public/prepurchase",
    asyncCatch(async (req, res) => {
        const cart = req.body as Cart;
        const userId = req.user.id;

        const logContext: LogMessage = {
            transactionToken: null,
            userIdInsecure: userId,
            important: false,
            fields: [{ header: "", content: "" }],
        };
        const logMessage = logContext.fields[0];

        if (!connection.isConnected()) {
            res.status(502).send("Game connection is not available");
            return;
        }

        let order: Order;
        let validationError: string | null;
        let fail = "register";
        try {
            order = await createOrder(userId, cart);
            fail = "validate";
            validationError = await validatePrepurchase(order);
        } catch (e: any) {
            logContext.important = true;
            logMessage.header = `Failed to ${fail} prepurchase`;
            logMessage.content = { cart, userId, error: e };
            sendToLogger(logContext).then();

            res.status(500).send("Failed to register prepurchase");
            return;
        }

        if (validationError) {
            logMessage.header = "Prepurchase failed validation";
            logMessage.content = { orderId: order.id };
            sendToLogger(logContext).then();
            res.status(409).send(validationError);
            return;
        }

        order.state = "prepurchase";
        await saveOrder(order);

        logMessage.header = "Created prepurchase";
        logMessage.content = { orderId: order.id };
        sendToLogger(logContext).then();

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
            fields: [{ header: "", content: "" }],
        };
        const logMessage = logContext.fields[0];

        if (transaction.type === "bits") {
            const validationResult = checkBitsTransaction(transaction);
            if (validationResult) {
                logMessage.header = validationResult.logHeaderOverride ?? validationResult.message;
                logMessage.content = validationResult.logContents ?? { transaction };
                if (validationResult.status === 403) {
                    setUserBanned(req.user, true);
                }
                res.status(validationResult.status).send(validationResult.message);
                return;
            }
        }

        let order: Order;
        try {
            const orderMaybe = await getAndCheckOrder(transaction, req.user);
            if ("status" in orderMaybe) {
                const checkRes = orderMaybe;
                logMessage.header = checkRes.logHeaderOverride ?? checkRes.message;
                logMessage.content = checkRes.logContents ?? { transaction };
                res.status(orderMaybe.status).send(orderMaybe.message);
                return;
            } else {
                order = orderMaybe;
            }
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

        if (order.userId != req.user.id) {
            // paying for somebody else, how generous
            logContext.important = true;
            logMessage.header = "Mismatched user ID";
            logMessage.content = {
                user: req.user,
                order: order.id,
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
                transaction,
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

        let userInfo: TwitchUser = {
            id: req.user.id,
            login: req.user.login ?? req.user.id,
            displayName: req.user.displayName ?? req.user.id,
        };
        if (!req.user.login || !req.user.displayName) {
            try {
                await updateUserTwitchInfo(req.user);
                userInfo.login = req.user.login!;
                userInfo.displayName = req.user.displayName!;
            } catch (error) {
                logContext.important = true;
                logMessage.header = "Could not get Twitch user info";
                logMessage.content = {
                    configVersion: currentConfig.version,
                    order,
                };
                sendToLogger(logContext).then();
                // very much not ideal but they've already paid... so...
                console.log(`Error while trying to get Twitch user info: ${error}`);
            }
        }

        try {
            const result = await connection.redeem(redeem, order, userInfo);
            const processedResult = await processRedeemResult(order, result);
            logContext.important = processedResult.status !== 200;
            logMessage.header = processedResult.logHeaderOverride ?? processedResult.message;
            logMessage.content = processedResult.logContents ?? { transaction };
            sendToLogger(logContext).then();
            res.status(processedResult.status).send(processedResult.message);
            return;
        } catch (error) {
            logContext.important = true;
            logMessage.header = "Failed to send redeem";
            logMessage.content = { config: currentConfig.version, order, error };
            sendToLogger(logContext).then();
            connection.onResult(order.id, (res) => {
                console.log(`Got late result (from re-send?) for ${order.id}`);
                processRedeemResult(order, res).then();
            });
            res.status(500).send(`Failed to process redeem - ${error}`);
            return;
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
                },
            ],
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

            if (order.state !== "prepurchase") {
                res.status(409).send("Cannot cancel this transaction");
                return;
            }

            order.state = "cancelled";
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
