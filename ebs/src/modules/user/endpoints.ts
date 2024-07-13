import { app } from "../..";
import { updateUserTwitchInfo, lookupUser, saveUser } from "../../util/db";
import { asyncCatch } from "../../util/middleware";
import { setUserBanned, setUserSession } from ".";

app.post(
    "/public/authorized",
    asyncCatch(async (req, res) => {
        const {session} = req.body as {session: string};
        const user = await updateUserTwitchInfo(req.user);
        
        // console.log(`${user.displayName} opened extension (session ${session})`);
        
        setUserSession(user, session);
        res.status(200).send({ credit: user.credit });
        return;
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
        res.status(200).json(user);
    })
);

app.post(
    "/private/user/:idOrName/addCredit",
    asyncCatch(async (req, res) => {
        const user = await lookupUser(req.params["idOrName"]);
        if (!user) {
            res.sendStatus(404);
            return;
        }
        
        const amt = parseInt(req.query["amount"] as string);
        if (!isFinite(amt)) {
            res.sendStatus(400);
            return;
        }

        user.credit += amt;
        await saveUser(user);
        res.status(200).json(user);
        return;
    })
);
