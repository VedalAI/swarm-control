import { User } from "common/types";
import { saveUser } from "../../util/db";
import { sendPubSubMessage } from "../../util/pubsub";

require("./endpoints");

export async function setUserBanned(user: User, banned: boolean) {
    user.banned = banned;
    await saveUser(user);
    await sendPubSubMessage({
        type: "banned",
        data: JSON.stringify({ id: user.id, banned }),
    });
}
