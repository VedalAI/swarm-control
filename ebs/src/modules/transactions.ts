import { Cart, Transaction } from "common/types";
//import { AnnounceType } from "common/types"; // esbuild dies
import { app } from "../index";
import { parseJWT, verifyJWT } from "../util/jwt";
import { BitsTransactionPayload } from "../types";
import { getConfig } from "./config";
import { getPrepurchase, isReceiptUsed, isUserBanned, registerPrepurchase, deletePrepurchase } from "../util/db";
import { logToDiscord } from "../util/logger";
import { connection } from "./game";
import { TwitchUser } from "./game/messages";
import { getHelixUser } from "../util/twitch";

app.post("/public/prepurchase", async (req, res) => {
    const cart = req.body as Cart;
    const idCart = { ...cart, userId: req.twitchAuthorization!.user_id! };

    if (await isUserBanned(req.twitchAuthorization!.user_id!)) {
        res.status(403).send("You are banned from using this extension.");
        return;
    }
    if (!connection.isConnected()) {
        res.status(502).send("Game connection is not available");
        return;
    }

    const config = await getConfig();
    if (cart.version != config.version) {
        logToDiscord({
            transactionToken: null,
            userIdInsecure: idCart.userId,
            important: false,
            fields: [
                {
                    header: "Invalid config version",
                    content: `Received: ${cart.version}\nExpected: ${config.version}`,
                },
            ],
        }).then();
        res.status(409).send(`Invalid config version (${cart.version}/${config.version})`);
        return;
    }

    // TODO: Verify redeem ID and sku
    // TODO: Verify redeem disabled/hidden status
    // TODO: Verify parameters
    // TODO: text input moderation

    let token: string;
    try {
        token = await registerPrepurchase(idCart);
    } catch (e: any) {
        logToDiscord({
            transactionToken: null,
            userIdInsecure: idCart.userId,
            important: true,
            fields: [
                {
                    header: "Failed to register prepurchase",
                    content: {
                        cart: idCart,
                        error: e,
                    }
                },
            ]
        }).then();
        res.status(500).send("Failed to register prepurchase");
        return;
    }

    logToDiscord({
        transactionToken: token,
        userIdInsecure: idCart.userId,
        important: false,
        fields: [
            {
                header: "Created prepurchase",
                content: {
                    cart: idCart,
                }
            }
        ]
    }).then();

    res.status(200).send(token);
});

app.post("/public/transaction", async (req, res) => {
    const transaction = req.body as Transaction;

    if (!transaction.receipt) {
        logToDiscord({
            transactionToken: transaction.token,
            userIdInsecure: req.twitchAuthorization!.user_id!,
            important: true,
            fields: [
                {
                    header: "Missing receipt",
                    content: transaction,
                },
            ],
        }).then();
        res.status(400).send("Missing receipt");
        return;
    }

    if (!verifyJWT(transaction.receipt)) {
        logToDiscord({
            transactionToken: transaction.token,
            userIdInsecure: req.twitchAuthorization!.user_id!,
            important: true,
            fields: [
                {
                    header: "Invalid receipt",
                    content: transaction,
                },
            ],
        }).then();
        res.status(403).send("Invalid receipt.");
        return;
    }

    const payload = parseJWT(transaction.receipt) as BitsTransactionPayload;

    if (await isReceiptUsed(payload.data.transactionId)) {
        logToDiscord({
            transactionToken: transaction.token,
            userIdInsecure: req.twitchAuthorization!.user_id!,
            important: true,
            fields: [
                {
                    header: "Transaction already processed",
                    content: transaction,
                },
            ],
        }).then();
        res.status(409).send("Transaction already processed");
        return;
    }

    const cart = await getPrepurchase(transaction.token);

    if (!cart) {
        logToDiscord({
            transactionToken: transaction.token,
            userIdInsecure: req.twitchAuthorization!.user_id!,
            important: true,
            fields: [
                {
                    header: "Invalid transaction token",
                    content: transaction,
                },
            ],
        }).then();
        res.status(404).send("Invalid transaction token");
        return;
    }

    // TODO: mark transaction fulfilled

    if (cart.userId != req.twitchAuthorization!.user_id!) {
        logToDiscord({
            transactionToken: transaction.token,
            userIdInsecure: req.twitchAuthorization!.user_id!,
            important: false,
            fields: [
                {
                    header: "Mismatched user ID",
                    content: {
                        auth: req.twitchAuthorization,
                        cart: cart,
                        transaction: transaction,
                    },
                },
            ],
        }).then();
    }

    const currentConfig = await getConfig();
    if (cart.version != currentConfig.version) {
        logToDiscord({
            transactionToken: transaction.token,
            userIdInsecure: req.twitchAuthorization!.user_id!,
            important: false,
            fields: [
                {
                    header: "Mismatched config version",
                    content: {
                        config: currentConfig.version,
                        cart: cart,
                        transaction: transaction,
                    },
                },
            ],
        }).then();
    }

    console.log(transaction);
    console.log(cart);

    const redeem = currentConfig.redeems?.[cart.id];
    if (!redeem) {
        logToDiscord({
            transactionToken: transaction.token,
            userIdInsecure: req.twitchAuthorization!.user_id!,
            important: false,
            fields: [
                {
                    header: "Redeem not found",
                    content: {
                        config: currentConfig.version,
                        cart: cart,
                        transaction: transaction,
                    },
                },
            ],
        }).then();
    } else {
        let userInfo = await getTwitchUser(cart.userId);
        if (!userInfo) {
            logToDiscord({
                transactionToken: transaction.token,
                userIdInsecure: req.twitchAuthorization!.user_id!,
                important: false,
                fields: [
                    {
                        header: "Could not get Twitch user info",
                        content: {
                            config: currentConfig.version,
                            cart: cart,
                            transaction: transaction,
                            error: userInfo,
                        }
                    }
                ]
            });
            // very much not ideal but they've already paid... so...
            userInfo = {
                id: cart.userId,
                login: cart.userId,
                displayName: cart.userId,
            }
        }
        connection.redeem(redeem, cart, userInfo, transaction.token);
    }

    res.sendStatus(200).send("Your transaction was successful! Your redeem will appear on stream soon.");
});

app.post("/public/transaction/cancel", async (req, res) => {
    const token = req.body.token as string;

    // remove transaction from db
    try {
        await deletePrepurchase(token);

        res.sendStatus(200);
    } catch (error) {
        logToDiscord({
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
        });

        res.sendStatus(404);
    }
});

async function getTwitchUser(id: string): Promise<TwitchUser | null> {
    const user = await getHelixUser(id);
    if (!user) {
        return null;
    }
    return {
        id: user.id,
        displayName: user.displayName,
        login: user.name,
    }
}