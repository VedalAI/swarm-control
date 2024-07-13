import { LogMessage } from "common/types";

const logEndpoint = `https://logger-subnautica.vedal.ai/log`;

export async function logToDiscord(data: LogMessage) {
    try {
        const result = await fetch(logEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...data,
            } satisfies LogMessage),
        });

        if (!result.ok) {
            console.error("Failed to log to backend");
            console.error(await result.text());
            console.log(data);
        }
    } catch (e: any) {
        console.error("Error when logging to backend");
        console.error(e);
        console.log(data);
    }
}
