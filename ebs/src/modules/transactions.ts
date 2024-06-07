import { Transaction } from "common/types";
import { app } from "../index";
import { parseJWT, verifyJWT } from "../jwt";
import { BitsTransactionPayload } from "../types";
import { getConfig, getPreviousConfig } from "./config";

const transactions: string[] = [];

app.post("/public/confirm_transaction", async (req, res) => {
    const version = req.body["version"] as number;

    console.log("Someone is trying to confirm a transaction with version ", version);

    const currentConfig = await getConfig();
    if (version != currentConfig.version) {
        res.status(409).send("Invalid config version");
        return;
    }

    res.sendStatus(200);
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

    if (transactions.includes(payload.data.transactionId)) {
        res.status(409).send("Transaction already processed");
        return;
    }

    const currentConfig = await getConfig();
    const previousConfig = getPreviousConfig();
    if (transaction.version != currentConfig.version) {
        console.log("Someone's using the old config... kinda sus (us:", currentConfig.version, ", them:", transaction.version, ")");
        if (!previousConfig || transaction.version != previousConfig.version) {
            console.warn("Nevermind they are cheating, ban them");
            // TODO: log information about this user so we can ban them
            res.status(409).send("Invalid config version");
            return;
        }
    }

    // At this point we know they paid for it and WE HAVE TO HONOR THE PURCHASE

    console.log(transaction);

    // TODO: Verify user banned status
    // TODO: Verify redeem ID and sku
    // TODO: Verify redeem disabled/hidden status
    // TODO: Verify parameters

    // TODO: send stuff to mod

    res.sendStatus(200);
});
