import { app } from "../../index";
import { logToDiscord } from "../../util/logger";
import { GameConnection } from "./connection";
import { MessageType } from "./messages";
import { ResultMessage } from "./messages.game";
import { CommandInvocationSource, RedeemMessage } from "./messages.server";

export let connection: GameConnection = new GameConnection();

connection.onResult((res) => {
    if (!res.success) {
        logToDiscord({
            transactionToken: res.guid,
            userIdInsecure: null,
            important: false,
            fields: [
                {
                    header: "Redeem did not succeed",
                    content: res,
                },
            ],
        });
    } else {
        console.log(`[${res.guid}] Redeem succeeded: ${JSON.stringify(res)}`);
    }
})

app.ws("/private/socket", async (ws, req) => {
    connection.setSocket(ws);
})

app.post("/private/redeem", async (req, res) => {
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

    connection.sendMessage(msg);
    res.status(201).send(JSON.stringify(msg));
})

app.post("/private/setresult", async (req, res) => {
    //console.log(req.body);
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