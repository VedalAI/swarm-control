import { Order, Redeem } from "common/types";
import { ResultMessage } from "../game/messages.game";
import { MessageType, TwitchUser } from "../game/messages";
import { connection } from "../game";
import { sendToLogger } from "../../util/logger";

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
        status: success ? "success" : "error",
    };
    if (!success) {
        result.message = "Failed to send PiShock operation";
    }
    return result;
}

const apiUrl: string = "https://do.pishock.com/api/apioperate/";

async function sendOperation(op: number, intensity: number, duration: number) {
    try {
        const data = {
            Username: process.env.PISHOCK_USERNAME,
            Apikey: process.env.PISHOCK_APIKEY,
            Code: process.env.PISHOCK_CODE,
            Name: "Swarm Control",

            Op: op,
            Intensity: intensity,
            Duration: duration,
        };

        console.log(`Sending PiShock operation: ${op} ${intensity} ${duration}`);

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            console.error("Failed to send PiShock operation");
            console.error(response.status, await response.text());
            return false;
        }

        return true;
    } catch (e: any) {
        console.error("Failed to send PiShock operation");
        console.error(e);
        return false;
    }
}

export function sendShock(intensity: number, duration: number) {
    return sendOperation(0, intensity, duration);
}
