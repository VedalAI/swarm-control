import { app } from "../..";
import { updateUserTwitchInfo, lookupUser } from "../../util/db";
import { asyncCatch } from "../../util/middleware";
import { setUserBanned, setUserSession } from ".";

app.post(
    "/public/authorized",
    asyncCatch(async (req, res) => {
        const {session} = req.body as {session: string};
        // console.log(`${req.auth.opaque_user_id} opened extension (session ${session})`);
        setUserSession(req.user, session);
        
        updateUserTwitchInfo(req.user).then();
        
        res.sendStatus(200);
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
        console.log(`[Private API] Banned ${user.login ?? user.id}`);
        res.status(200).json(user);
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
        console.log(`[Private API] Unbanned ${user.login ?? user.id}`);
        res.status(200).json(user);
    })
);
