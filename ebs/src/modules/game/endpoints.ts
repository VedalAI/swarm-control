import { app } from "../..";
import { connection } from ".";
import { asyncCatch } from "../../util/middleware";
import { MessageType } from "./messages";
import { ResultMessage } from "./messages.game";
import { CommandInvocationSource, RedeemMessage } from "./messages.server";
import { isStressTesting, startStressTest, StressTestRequest } from "./stresstest";

app.post(
    "/private/redeem",
    asyncCatch(async (req, res) => {
        //console.log(req.body);
        const msg = {
            ...connection.makeMessage(MessageType.Redeem),
            source: CommandInvocationSource.Dev,
            ...req.body,
        } as RedeemMessage;
        if (!connection.isConnected()) {
            res.status(500).send("Not connected");
            return;
        }

        try {
            await connection.sendMessage(msg);
            res.status(201).send(JSON.stringify(msg));
        } catch (e) {
            res.status(500).send(e);
        }
    })
);

app.post("/private/setresult", (req, res) => {
    const msg = {
        ...connection.makeMessage(MessageType.Result),
        ...req.body,
    } as ResultMessage;
    if (!connection.isConnected()) {
        res.status(500).send("Not connected");
        return;
    }

    connection.processMessage(msg);
    res.sendStatus(200);
});

app.post("/private/stress", (req, res) => {
    if (!process.env.ENABLE_STRESS_TEST) {
        res.status(501).send("Disabled unless you set the ENABLE_STRESS_TEST env var\nREMEMBER TO REMOVE IT FROM PROD");
        return;
    }

    if (isStressTesting()) {
        res.status(400).send("Already stress testing");
        return;
    }

    if (!connection.isConnected()) {
        res.status(500).send("Not connected");
        return;
    }

    const reqObj = req.body as StressTestRequest;
    if (reqObj.type === undefined || reqObj.duration === undefined || reqObj.interval === undefined) {
        res.status(400).send("Must have type, duration, and interval");
        return;
    }
    console.log(reqObj);
    startStressTest(reqObj.type, reqObj.duration, reqObj.interval);
    res.sendStatus(200);
});

app.get("/private/unsent", (req, res) => {
    const unsent = connection.getUnsent();
    res.send(JSON.stringify(unsent));
});

app.get("/private/outstanding", (req, res) => {
    const outstanding = connection.getOutstanding();
    res.send(JSON.stringify(outstanding));
});
