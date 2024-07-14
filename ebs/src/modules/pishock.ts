import { Order, Redeem } from "common/types";
import { ResultMessage } from "./game/messages.game";
import { MessageType, TwitchUser } from "./game/messages";
import { connection } from "./game";
import { sendToLogger } from "../util/logger";
import { sendShock } from "../util/pishock";

const pishockRedeemId = "redeem_pishock";

require("./game"); // init connection just in case import order screwed us over

connection.addRedeemHandler(pishockRedeem);

export async function pishockRedeem(redeem: Redeem, order: Order, user: TwitchUser): Promise<ResultMessage | null> {
    if (redeem.id != pishockRedeemId) {
        return null;
    }

    sendToLogger({
        transactionToken: order.id,
        userIdInsecure: order.userId,
        important: false,
        fields: [{ header: "PiShock Redeem", content: `${user.displayName} redeemed PiShock` }],
    });

    const success = await sendShock(50, 100);
    const result: ResultMessage = {
        messageType: MessageType.Result,
        guid: order.id,
        timestamp: Date.now(),
        success,
    };
    if (!success) {
        result.message = "Failed to send PiShock operation";
    }
    return result;
}

