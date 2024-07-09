import { User } from "common/types";
import { app } from "../..";
import { lookupUser, saveUser, updateUserTwitchInfo } from "../../util/db";
import { asyncCatch } from "../../util/middleware";
import { sendPubSubMessage } from "../../util/pubsub";

export async function setUserBanned(user: User, banned: boolean) {
    user.banned = banned;
    await saveUser(user);
    await sendPubSubMessage({
        type: "banned",
        data: JSON.stringify({ id: user.id, banned }),
    });
}

app.post(
    "/public/authorized",
    asyncCatch(async (req, res) => {
        res.sendStatus(200);
        updateUserTwitchInfo(req.user).then().catch(console.error);
    })
);

app.get("/private/user/:idOrName", asyncCatch(async (req, res) => {
    res.json(await lookupUser(req.params["idOrName"]));
}));

app.post(
    "/private/user/:idOrName/ban",
    asyncCatch(async (req, res) => {
        const user = await lookupUser(req.params["idOrName"]);
        if (!user) {
            res.sendStatus(404);
            return;
        }

        await setUserBanned(user, true);
        res.sendStatus(200);
    })
);

app.delete(
    "/private/user/:idOrName/ban",
    asyncCatch(async (req, res) => {
        const user = await lookupUser(req.params["idOrName"]);
        if (!user) {
            res.sendStatus(404);
            return;
        }

        await setUserBanned(user, false);
        res.sendStatus(200);
    })
);
