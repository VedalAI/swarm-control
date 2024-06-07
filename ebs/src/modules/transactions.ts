import { Cart, Transaction } from "common/types";
import { app } from "../index";
import { parseJWT, verifyJWT } from "../util/jwt";
import { BitsTransactionPayload } from "../types";
import { getConfig } from "./config";
import { getPrepurchase, isReceiptUsed, registerPrepurchase } from "../util/db";

app.post("/public/prepurchase", async (req, res) => {
    const cart = req.body as Cart;

    const config = await getConfig();
    if (cart.version != config.version) {
        res.status(409).send(`Invalid config version (${cart.version}/${config.version})`);
        return;
    }

    if (config.banned && config.banned.includes(req.twitchAuthorization!.user_id!)) {
        res.status(403).send("You are banned from using this extension");
        return;
    }

    // TODO: Verify redeem ID and sku
    // TODO: Verify redeem disabled/hidden status
    // TODO: Verify parameters
    // TODO: text input moderation

    const token = await registerPrepurchase(cart);

    res.status(200).send(token);
});

app.post("/public/transaction", async (req, res) => {
    const transaction = req.body as Transaction;

    if (!transaction.receipt) {
        res.status(400).send("Missing receipt");
        return;
    }

    if (!verifyJWT(transaction.receipt)) {
        res.status(403).send("Invalid receipt");
        return;
    }

    const payload = parseJWT(transaction.receipt) as BitsTransactionPayload;

    if (await isReceiptUsed(payload.data.transactionId)) {
        res.status(409).send("Transaction already processed");
        return;
    }

    const cart = await getPrepurchase(payload.data.transactionId);

    if (!cart) {
        res.status(404).send("Invalid transaction token");
        return;
    }

    // TODO: mark transaction fulfilled

    const currentConfig = await getConfig();
    if (cart.version != currentConfig.version) {
        console.log(
            "Someone's using the old config... kinda sus (us:",
            currentConfig.version,
            ", them:",
            cart.version,
            ")"
        );
        // TODO: add logging
    }

    console.log(transaction);
    console.log(cart);

    // TODO: send stuff to mod

    res.sendStatus(200);
});
