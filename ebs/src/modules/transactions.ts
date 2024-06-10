import { Cart, Transaction } from "common/types";
import { app } from "../index";
import { parseJWT, verifyJWT } from "../util/jwt";
import { BitsTransactionPayload } from "../types";
import { getConfig } from "./config";
import { getPrepurchase, isReceiptUsed, isUserBanned, registerPrepurchase } from "../util/db";
import { logToDiscord } from "../util/logger";

app.post("/public/prepurchase", async (req, res) => {
    const cart = req.body as Cart;
    const idCart = { ...cart, userId: req.twitchAuthorization!.user_id! };

    if (await isUserBanned(req.twitchAuthorization!.user_id!)) {
        res.status(403).send("You are banned from using this extension.");
        return;
    }

    const config = await getConfig();
    if (cart.version != config.version) {
        logToDiscord({
            transactionToken: null,
            userId: idCart.userId,
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

    const token = await registerPrepurchase(idCart);

    res.status(200).send(token);
});

app.post("/public/transaction", async (req, res) => {
    const transaction = req.body as Transaction;

    if (!transaction.receipt) {
        logToDiscord({
            transactionToken: transaction.token,
            userId: req.twitchAuthorization!.user_id!,
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
            userId: req.twitchAuthorization!.user_id!,
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
            userId: req.twitchAuthorization!.user_id!,
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
            userId: req.twitchAuthorization!.user_id!,
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
            userId: req.twitchAuthorization!.user_id!,
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
            userId: req.twitchAuthorization!.user_id!,
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

    // TODO: send stuff to mod

    res.sendStatus(200);
});
