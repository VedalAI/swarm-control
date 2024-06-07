import { app } from "../index";
import { Connection } from "./game/connection";
import { MessageType } from "./game/messages";
import { ResultMessage } from "./game/messages.game";
import { CommandInvocationSource, RedeemMessage } from "./game/messages.server";

export let connection: Connection = new Connection();
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