import { LogMessage } from "common/types";

const logEndpoint = `http://${process.env.LOGGER_HOST!}:3000/log`;

export async function sendToLogger(data: LogMessage) {
    try {
        const result = await fetch(logEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...data,
                backendToken: process.env.PRIVATE_LOGGER_TOKEN!,
            } satisfies LogMessage & { backendToken?: string }),
        });

        if (!result.ok) {
            console.error("Failed to log to Discord");
            console.error(await result.text());
            console.log(data);
        }
    } catch (e: any) {
        console.error("Error when logging to Discord");
        console.error(e);
        console.log(data);
    }
}
