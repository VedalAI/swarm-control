import cors from "cors";
import express from "express";
import {BitsTransactionPayload, Transaction} from "./types";
import bodyParser from "body-parser";
import {parseJWT, verifyJWT} from "./jwt";
import {authMiddleware} from "./middleware";

const app = express();
app.use(cors({origin: "*"}))
app.use(bodyParser.json());
app.use(authMiddleware);
app.listen(3000);

const transactions: string[] = [];

app.get("/redeems", (req, res) => {
    res.send(JSON.stringify([
        {
            id: "1",
            title: "Spawn Ermfish",
            description: "Spawn ermfish long description yes",
            image: "/img/Erm.png",
            price: 100,
            sku: "bits100"
        }
    ]));
});

app.post("/transaction", (req, res) => {
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
