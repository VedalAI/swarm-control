import { EbsCallConfig, sendExtensionPubSubGlobalMessage } from "@twurple/ebs-helper";
import { PubSubMessage } from "common/types";

const config: EbsCallConfig = {
    clientId: process.env.CLIENT_ID!,
    ownerId: process.env.OWNER_ID!,
    secret: process.env.JWT_SECRET!,
};

export async function sendPubSubMessage(message: PubSubMessage) {
    return sendExtensionPubSubGlobalMessage(config, JSON.stringify(message));
}
