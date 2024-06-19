import { app } from "../..";
import { getOrAddUser, saveUser } from "../../util/db";
import { asyncCatch } from "../../util/middleware";
import { sendPubSubMessage } from "../../util/pubsub";

export async function setUserBanned(id: string, banned: boolean) {
    const user = await getOrAddUser(id);
    user.banned = banned;
    await saveUser(user);
    await sendPubSubMessage({
        type: "banned",
        data: JSON.stringify({id, banned}),
    });
}

app.post("/public/authorized", asyncCatch(async (req, res) => {
    res.sendStatus(200);
}))

app.post("/private/ban/:id", asyncCatch(async (req, res) => {
    const id = req.params["id"];
    await setUserBanned(id, true);
    res.sendStatus(200);
}))

app.delete("/private/ban/:id", asyncCatch(async (req, res) => {
    const id = req.params["id"];
    await setUserBanned(id, false);
    res.sendStatus(200);
}))

app.post("/private/credit/:id", asyncCatch(async (req, res) => {
    const id = req.params["id"];
    const amount = req.body.amount as number;
    const user = await getOrAddUser(id);
    user.credit += amount;
    await saveUser(user);
    res.sendStatus(200);
}))