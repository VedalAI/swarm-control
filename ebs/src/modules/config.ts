import { Config } from "common/types";
import { app } from "../index";
import { sendPubSubMessage } from "../pubsub";
import { pack } from "jsonpack";
import { ApiClient } from "@twurple/api";
import { StaticAuthProvider } from "@twurple/auth";

const apiClient = new ApiClient({
    authProvider: new StaticAuthProvider(process.env.APP_CLIENT_ID!, process.env.ACCESS_TOKEN!),
});

let config: Config | undefined;
let previousConfig: Config | undefined;
let previousConfigUsableUntil: Date | undefined;

// const gistUrl = "https://gist.githubusercontent.com/Alexejhero/804fe0900d015b89a934a9b759ba2330/raw"
const gistUrl = "https://gist.githubusercontent.com/Zyrenth/1ae853881e967e94d3295b90851b6a3e/raw"

async function fetchConfig(): Promise<Config> {
    const url = `${gistUrl}?${Date.now()}`;

    const response = await fetch(url);
    const data = await response.json();

    return data as Config;
}

export async function getConfig(): Promise<Config> {
    if (!config) {
        config = await fetchConfig();
    }

    return config;
}

export function getPreviousConfig(): Config | undefined {
    if (previousConfigUsableUntil && previousConfigUsableUntil > new Date()) {
        return previousConfig;
    }
    return undefined;
}

app.get("/private/refresh", async (_, res) => {
    const newConfig = await fetchConfig();
    previousConfig = config;
    config = newConfig;
    previousConfigUsableUntil = new Date(Date.now() + 1000 * 10);
    console.log("Refreshed config, new config version is ", config.version);
    await sendPubSubMessage({
        type: "config_refreshed",
        data: pack(newConfig)
    });
    res.sendStatus(200);
});

app.get("/public/config", async (req, res) => {
    const amBanned = await apiClient.moderation.checkUserBan(process.env.RUNNING_CHANNEL!, req.twitchAuthorization!.user_id!);
    if (amBanned) {
        res.status(403).send("You cannot use this extension while banned or timed out");
        return;
    }

    const config = await getConfig();
    res.send(JSON.stringify(config));
});
