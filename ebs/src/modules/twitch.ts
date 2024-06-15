import { app } from "..";
import { asyncCatch } from "../util/middleware";
import { getHelixUser } from "../util/twitch";
import { TwitchUser } from "./game/messages";

app.get("/private/user/:id", asyncCatch(async (req, res) => {
    res.json(await getTwitchUser(req.params["id"]));
}));

export async function getTwitchUser(id: string): Promise<TwitchUser | null> {
    const user = await getHelixUser(id);
    if (!user) {
        return null;
    }
    return {
        id: user.id,
        displayName: user.displayName,
        login: user.name,
    };
}