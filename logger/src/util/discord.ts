import { Webhook } from "@vermaysha/discord-webhook";
import { LogMessage } from "common/types";
import { stringify } from "./stringify";

const hook = new Webhook(process.env.DISCORD_WEBHOOK!);
hook.setUsername("Swarm Control");

function log(message: string) {
    console.error(message);
    hook.setContent(message.substring(0, 1950));
    hook.send().then();
}

export function logToDiscord(logMessage: LogMessage, isFromBackend: boolean) {
    log(stringify(logMessage, isFromBackend));
}
