import { User } from "common/types";
import { saveUser } from "../../util/db";
import { sendPubSubMessage } from "../../util/pubsub";

require("./endpoints");

const sessions: Map<string, string> = new Map();

export async function setUserBanned(user: User, banned: boolean) {
    user.banned = banned;
    await saveUser(user);
    sendPubSubMessage({
        type: "banned",
        data: JSON.stringify({ id: user.id, banned }),
    }).then();
}

export async function getUserSession(user: User): Promise<string | null> {
    return sessions.get(user.id) || null;
}

export async function setUserSession(user: User, session: string) {
    const existing = sessions.get(user.id);
    if (existing) {
        console.log(`Closing existing session ${existing} in favor of ${session}`);
    }
    sessions.set(user.id, session);
}
