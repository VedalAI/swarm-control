import { getHelixUser } from "../util/twitch";
import { TwitchUser } from "./game/messages";

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