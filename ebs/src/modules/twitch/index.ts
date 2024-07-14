import { getHelixUser } from "../../util/twitch";
import { TwitchUser } from "../game/messages";

export async function getTwitchUser(id: string): Promise<TwitchUser | null> {
    const user = await getHelixUser(id);
    if (!user) {
        console.warn(`Twitch user ${id} was not found`);
        return null;
    }
    return {
        id: user.id,
        login: user.name,
        displayName: user.displayName,
    };
}