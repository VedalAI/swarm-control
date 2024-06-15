import { app } from "..";
import { asyncCatch } from "../util/middleware";
import { getHelixUser } from "../util/twitch";

app.get("/private/user/:id", asyncCatch(async (req, res) => {
    res.json(await getHelixUser(req.params["id"]));
}));
