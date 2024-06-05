import {BitsTransactionPayload, Transaction} from "../types";
import {parseJWT, verifyJWT} from "../jwt";
import {app} from "../index";

const transactions: string[] = [];

app.post("/public/transaction", (req, res) => {
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

    // At this point we know they paid for it and WE HAVE TO HONOR THE PURCHASE

    // TODO: send stuff to mod

    res.sendStatus(200);
});
