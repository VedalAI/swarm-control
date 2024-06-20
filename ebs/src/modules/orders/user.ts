import { app } from "../..";
import { getOrAddUser, saveUser, updateUserTwitchInfo } from "../../util/db";
import { asyncCatch } from "../../util/middleware";
import { sendPubSubMessage } from "../../util/pubsub";

export async function setUserBanned(id: string, banned: boolean) {
    const user = await getOrAddUser(id);
    user.banned = banned;
    await saveUser(user);
    await sendPubSubMessage({
        type: "banned",
        data: JSON.stringify({ id, banned }),
    });
}

app.post(
    "/public/authorized",
    asyncCatch(async (req, res) => {
        res.sendStatus(200);
        updateUserTwitchInfo(req.user).then().catch(console.error);
    })
);

app.get("/private/user/:id", asyncCatch(async (req, res) => {
    res.json(await getOrAddUser(req.params["id"]));
}));

app.get(
    "/private/user/:id/ban",
    asyncCatch(async (req, res) => {
        const id = req.params["id"];
        const user = await getOrAddUser(id);
        res.send({ banned: user.banned });
    })
);

app.post(
    "/private/user/:id/ban",
    asyncCatch(async (req, res) => {
        const id = req.params["id"];
        await setUserBanned(id, true);
        res.sendStatus(200);
    })
);

app.delete(
    "/private/user/:id/ban",
    asyncCatch(async (req, res) => {
        const id = req.params["id"];
        await setUserBanned(id, false);
        res.sendStatus(200);
    })
);
