import { app } from "../..";
import { updateUserTwitchInfo, lookupUser } from "../../util/db";
import { asyncCatch } from "../../util/middleware";
import { setUserBanned } from ".";

app.post(
    "/public/authorized",
    asyncCatch(async (req, res) => {
        res.sendStatus(200);
        updateUserTwitchInfo(req.user).then().catch(console.error);
    })
);

app.get(
    "/private/user/:idOrName",
    asyncCatch(async (req, res) => {
        res.json(await lookupUser(req.params["idOrName"]));
    })
);

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
