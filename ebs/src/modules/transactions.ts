import { Cart, Config, LogMessage, Transaction } from "common/types";
import { app } from "..";
import { parseJWT, verifyJWT } from "../util/jwt";
import { BitsTransactionPayload } from "../types";
import { getConfig } from "./config";
import { addFulfilledTransaction, deletePrepurchase, getPrepurchase, isReceiptUsed, isUserBanned, registerPrepurchase } from "../util/db";
import { sendToLogger } from "../util/logger";
import { connection } from "./game";
import { TwitchUser } from "./game/messages";
import { getHelixUser } from "../util/twitch";
import { asyncCatch } from "../util/middleware";

app.post(
    "/public/prepurchase",
    asyncCatch(async (req, res) => {
        const cart = req.body as Cart;
        const idCart = { ...cart, userId: req.twitchAuthorization!.user_id! };

        if (await isUserBanned(req.twitchAuthorization!.user_id!)) {
            res.status(403).send("You are banned from using this extension.");
            return;
        }

        if (await isUserBanned(req.twitchAuthorization!.opaque_user_id!)) {
            res.status(403).send("You are banned from using this extension.");
            return;
        }

        if (!connection.isConnected()) {
            res.status(502).send("Game connection is not available");
            return;
        }

        const logContext: LogMessage = {
            transactionToken: null,
            userIdInsecure: idCart.userId,
            important: false,
            fields: [
                {
                    header: "",
                    content: "",
                },
            ],
        };
        const logMessage = logContext.fields[0];

        const config = await getConfig();
        if (cart.version != config.version) {
            logMessage.header = "Invalid config version";
            logMessage.content = `Received: ${cart.version}\nExpected: ${config.version}`;
            sendToLogger(logContext).then();
            res.status(409).send(`Invalid config version (${cart.version}/${config.version})`);
            return;
        }

        const redeem = config.redeems?.[cart.id];
        if (!redeem || redeem.sku != cart.sku || redeem.disabled || redeem.hidden) {
            logMessage.header = "Invalid redeem";
            logMessage.content = `Received: ${JSON.stringify(cart)}\nRedeem in config: ${JSON.stringify(redeem)}`;
            sendToLogger(logContext).then();
            res.status(409).send(`Invalid redeem`);
            return;
        }

        const valError = validateArgs(config, cart, logContext);
        if (valError) {
            logMessage.header = "Arg validation failed";
            logMessage.content = {
                error: valError,
                redeem: cart.id,
                expected: redeem.args,
                provided: cart.args,
            };
            sendToLogger(logContext).then();
            res.status(409).send("Invalid arguments");
            return;
        }

        let token: string;
        try {
            token = await registerPrepurchase(idCart);
        } catch (e: any) {
            logContext.important = true;
            logMessage.header = "Failed to register prepurchase";
            logMessage.content = { cart: idCart, error: e };
            sendToLogger(logContext).then();
            res.status(500).send("Failed to register prepurchase");
            return;
        }

        logMessage.header = "Created prepurchase";
        logMessage.content = { cart: idCart };
        sendToLogger(logContext).then();

        res.status(200).send(token);
    })
);

app.post(
    "/public/transaction",
    asyncCatch(async (req, res) => {
        const transaction = req.body as Transaction;

        const logContext: LogMessage = {
            transactionToken: transaction.token,
            userIdInsecure: req.twitchAuthorization!.user_id!,
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

        if (await isReceiptUsed(payload.data.transactionId)) {
            logMessage.header = "Transaction already processed";
            logMessage.content = transaction;
            sendToLogger(logContext).then();
            res.status(409).send("Transaction already processed");
            return;
        }

        const cart = await getPrepurchase(transaction.token);

        if (!cart) {
            logMessage.header = "Invalid transaction token";
            logMessage.content = transaction;
            sendToLogger(logContext).then();
            res.status(404).send("Invalid transaction token");
            return;
        }

        await addFulfilledTransaction(transaction.receipt, transaction.token, req.twitchAuthorization!.user_id!);

        if (cart.userId != req.twitchAuthorization!.user_id!) {
            logContext.important = true;
            logMessage.header = "Mismatched user ID";
            logMessage.content = {
                auth: req.twitchAuthorization,
                cart,
                transaction,
            };
            sendToLogger(logContext).then();
        }

        const currentConfig = await getConfig();
        if (cart.version != currentConfig.version) {
            logContext.important = true;
            logMessage.header = "Mismatched config version";
            logMessage.content = {
                config: currentConfig.version,
                cart: cart,
                transaction: transaction,
            };
            sendToLogger(logContext).then();
        }

        console.log(transaction);
        console.log(cart);

        const redeem = currentConfig.redeems?.[cart.id];
        if (!redeem) {
            logContext.important = true;
            logMessage.header = "Redeem not found";
            logMessage.content = {
                config: currentConfig.version,
                cart: cart,
                transaction: transaction,
            };
            sendToLogger(logContext).then();
            res.status(500).send("Redeem could not be found");
            return;
        }

        let userInfo: TwitchUser | null;
        try {
            userInfo = await getTwitchUser(cart.userId);
        } catch {
            userInfo = null;
        }
        if (!userInfo) {
            logContext.important = true;
            logMessage.header = "Could not get Twitch user info";
            logMessage.content = {
                config: currentConfig.version,
                cart: cart,
                transaction: transaction,
                error: userInfo,
            };
            sendToLogger(logContext).then();
            // very much not ideal but they've already paid... so...
            userInfo = {
                id: cart.userId,
                login: cart.userId,
                displayName: cart.userId,
            };
        }
        try {
            // TODO: special handling for different types of redeems

            const resMsg = await connection.redeem(redeem, cart, userInfo, transaction.token);
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
                cart: cart,
                transaction: transaction,
                error: error,
            };
            sendToLogger(logContext).then();
            res.status(500).send(`Failed to process redeem - ${error}`);
        }
    })
);

app.post(
    "/public/transaction/cancel",
    asyncCatch(async (req, res) => {
        const token = req.body.token as string;

        // remove transaction from db
        try {
            await deletePrepurchase(token);

            res.sendStatus(200);
        } catch (error) {
            sendToLogger({
                transactionToken: token,
                userIdInsecure: req.twitchAuthorization!.user_id!,
                important: false,
                fields: [
                    {
                        header: "Error deleting transaction",
                        content: {
                            error: error,
                        },
                    },
                ],
            }).then();

            res.sendStatus(404);
        }
    })
);

async function getTwitchUser(id: string): Promise<TwitchUser | null> {
    const user = await getHelixUser(id);
    if (!user) {
        return null;
    }
    return {
        id: user.id,
        displayName: user.displayName,
        login: user.name,
    };
}

function validateArgs(config: Config, cart: Cart, logContext: LogMessage): string | undefined {
    const redeem = config.redeems![cart.id];

    for (const arg of redeem.args) {
        const value = cart.args[arg.name];
        if (!value) {
            if (!arg.required) continue;

            // LiteralTypes.Boolean
            if (arg.type === 3) {
                // HTML form conventions - false is not transmitted, true is "on" (to save 2 bytes i'm guessing)
                continue;
            }

            return `Missing required argument ${arg.name}`;
        }
        let parsed: number;
        switch (arg.type) {
            // esbuild dies if you use enums
            // so we have to use their pure values instead
            case 0: // LiteralTypes.String
                if (typeof value !== "string") {
                    return `Argument ${arg.name} not a string`;
                }
                const minLength = arg.minLength ?? 0;
                const maxLength = arg.maxLength ?? 255;
                if (value.length < minLength || value.length > maxLength) {
                    return `Text length out of range for ${arg.name}`;
                }
                break;
            case 1: // LiteralTypes.Integer
            case 2: // LiteralTypes.Float
                parsed = parseInt(value);
                if (Number.isNaN(parsed)) {
                    return `Argument ${arg.name} is not a number`;
                }
                // LiteralTypes.Integer
                if (arg.type === 1 && parseFloat(value) != parsed) {
                    return `Argument ${arg.name} is not an integer`;
                }
                if ((arg.min !== undefined && parsed < arg.min) || (arg.max !== undefined && parsed > arg.max)) {
                    return `Number ${arg.name} out of range`;
                }
                break;
            case 3: // LiteralTypes.Boolean
                if (typeof value !== "boolean" && value !== "true" && value !== "false" && value !== "on") {
                    return `Argument ${arg.name} not a boolean`;
                }
                if (value === "on") {
                    cart.args[arg.name] = true;
                }
                break;
            case 4: // LiteralTypes.Vector
                if (!Array.isArray(value) || value.length < 3) {
                    return `Vector3 ${arg.name} not a 3-elem array`;
                }
                // workaround for #49
                const lastThree = value.slice(value.length - 3);
                for (const v of lastThree) {
                    parsed = parseFloat(v);
                    if (Number.isNaN(parsed)) {
                        return `Vector3 ${arg.name} components not all floats`;
                    }
                }
                cart!.args[arg.name] = lastThree;
                break;
            default:
                const argEnum = config.enums?.[arg.type];
                if (!argEnum) {
                    return `No such enum ${arg.type}`;
                }
                parsed = parseInt(value);
                if (Number.isNaN(parsed) || parsed != parseFloat(value)) {
                    return `Enum value ${value} (for enum ${arg.type}) not an integer`;
                }
                if (parsed < 0 || parsed >= argEnum.length) {
                    return `Enum value ${value} (for enum ${arg.type}) out of range`;
                }
                break;
        }
    }
}
