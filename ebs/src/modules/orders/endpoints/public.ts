import { Cart, LogMessage, Transaction, Order, TransactionTokenPayload, TransactionToken } from "common/types";
import { app } from "../../..";
import { getConfig } from "../../config";
import { createOrder, getOrder, saveOrder, updateUserTwitchInfo } from "../../../util/db";
import { sendToLogger } from "../../../util/logger";
import { connection } from "../../game";
import { TwitchUser } from "../../game/messages";
import { asyncCatch } from "../../../util/middleware";
import { validatePrepurchase } from "../prepurchase";
import { setUserBanned } from "../../user";
import { decodeJWTPayloads, getAndCheckOrder, jwtExpirySeconds, makeTransactionToken, processRedeemResult } from "../transaction";
import { parseJWT, signJWT, verifyJWT } from "../../../util/jwt";
import { HttpResult } from "../../../types";

const usedBitsTransactionIds: Set<string> = new Set();

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
        let validationError: HttpResult | null;
        let fail = "register";
        try {
            order = await createOrder(userId, cart);
            fail = "validate";
            validationError = await validatePrepurchase(order, req.user);
        } catch (e: any) {
            logContext.important = true;
            logMessage.header = `Failed to ${fail} prepurchase`;
            logMessage.content = { cart, userId, error: e };
            sendToLogger(logContext).then();

            res.status(500).send("Failed to register prepurchase");
            return;
        }

        if (validationError) {
            logMessage.header = validationError.logHeaderOverride ?? validationError.message;
            logMessage.content = validationError.logContents ?? { order: order.id };
            sendToLogger(logContext).then();
            res.status(validationError.status).send(validationError.message);
            order.result = validationError.message;
            await saveOrder(order);
            return;
        }

        order.state = "prepurchase";
        await saveOrder(order);

        let transactionToken: TransactionToken;
        try {
            transactionToken = makeTransactionToken(order, req.user);
        } catch (e: any) {
            logContext.important = true;
            logMessage.header = `Failed to create transaction token`;
            logMessage.content = { cart, userId, error: e };
            sendToLogger(logContext).then();
            res.status(500).send("Internal configuration error");
            return;
        }
        const transactionTokenJWT = signJWT({ data: transactionToken }, { expiresIn: jwtExpirySeconds });

        logMessage.header = "Created prepurchase";
        logMessage.content = { orderId: order.id, token: transactionTokenJWT };
        sendToLogger(logContext).then();
        res.status(200).send(transactionTokenJWT);
        return;
    })
);

app.post(
    "/public/transaction",
    asyncCatch(async (req, res) => {
        const transaction = req.body as Transaction;

        const logContext: LogMessage = {
            transactionToken: null,
            userIdInsecure: req.user.id,
            important: true,
            fields: [{ header: "", content: transaction }],
        };
        const logMessage = logContext.fields[0];

        const decoded = decodeJWTPayloads(transaction);
        if ("status" in decoded) {
            logMessage.header = decoded.logHeaderOverride ?? decoded.message;
            logMessage.content = decoded.logContents ?? { transaction };
            if (decoded.status === 403) {
                setUserBanned(req.user, true);
            }
            sendToLogger(logContext).then();
            res.status(decoded.status).send(decoded.message);
            return;
        }
        logContext.transactionToken = decoded.token.data.id;

        let order: Order;
        try {
            const orderMaybe = await getAndCheckOrder(transaction, decoded, req.user);
            if ("status" in orderMaybe) {
                const checkRes = orderMaybe;
                logMessage.header = checkRes.logHeaderOverride ?? checkRes.message;
                logMessage.content = checkRes.logContents ?? { transaction };
                if (checkRes.status === 403) {
                    setUserBanned(req.user, true);
                }
                sendToLogger(logContext).then();
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

        const bitsTransaction = decoded.receipt.data.transactionId;
        if (usedBitsTransactionIds.has(bitsTransaction)) {
            // happens if there are X extension tabs that are all open on the twitch bits modal
            // twitch broadcasts onTransactionComplete to all of them and the client ends up
            // sending X requests for each completed transaction (where all but 1 will obviously be duplicates)
            // we don't want to auto-ban people just for having multiple tabs open
            // but it's still obviously not ideal behaviour
            if (order.cart.clientSession === transaction.clientSession) {
                // if it's not coming from a different tab, you're obviously trying to replay
                logMessage.content = {
                    order: order.id,
                    bitsTransaction: decoded.receipt.data,
                };
                logMessage.header = "Transaction replay";
                sendToLogger(logContext).then();
            }
            // unfortunately, in this case any other tab(s) awaiting twitchUseBits will still lose their purchase
            // so we do our best to not allow multiple active prepurchases in the first place
            res.status(401).send("Invalid transaction");
            return;
        }
        usedBitsTransactionIds.add(bitsTransaction);

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
        console.log(decoded);
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
            logContext.important = processedResult.status === 500;
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
        const jwt = req.body.jwt as string;
        if (!verifyJWT(jwt)) {
            res.sendStatus(403);
            return;
        }
        const token = parseJWT(jwt) as TransactionTokenPayload;
        const logContext: LogMessage = {
            transactionToken: token.data.id,
            userIdInsecure: req.user.id,
            important: true,
            fields: [{ header: "", content: "" }],
        };
        const logMessage = logContext.fields[0];

        try {
            const order = await getOrder(token.data.id);

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
                sendToLogger(logContext).then();
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
