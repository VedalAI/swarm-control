import { LogMessage } from "common/types";

export async function logToDiscord(data: LogMessage) {
    try {
        const result = await fetch(`http://${process.env.LOGGER_HOST!}:3000/log`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
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
