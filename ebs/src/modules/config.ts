import { Config } from "common/types";
import { app } from "../index";
import { sendPubSubMessage } from "../util/pubsub";
import { strToU8, compressSync, strFromU8 } from "fflate";
import { getBannedUsers } from "../util/db";

let config: Config | undefined;

const gistUrl = "https://raw.githubusercontent.com/VedalAI/swarm-control/main/config.json";

async function fetchConfig(): Promise<Config> {
    const url = `${gistUrl}?${Date.now()}`;

    try {
        const response = await fetch(url);
        const data: Config = await response.json();

        data.banned = await getBannedUsers();

        return data;
    } catch (e: any) {
        console.error("Error when fetching config");
        console.error(e);

        return {
            version: -1,
            message: "Error when fetching config",
        };
    }
}

export async function getConfig(): Promise<Config> {
    if (!config) {
        config = await fetchConfig();
    }

    return config;
}

export async function broadcastConfigRefresh(config: Config) {
    return sendPubSubMessage({
        type: "config_refreshed",
        data: strFromU8(compressSync(strToU8(JSON.stringify(config), true))),
    });
}

app.get("/private/refresh", async (_, res) => {
    config = await fetchConfig();
    console.log("Refreshed config, new config version is ", config.version);
    await broadcastConfigRefresh(config);
    res.sendStatus(200);
});

app.get("/public/config", async (req, res) => {
    const config = await getConfig();
    res.send(JSON.stringify(config));
});

(async () => {
    const config = await getConfig();
    await broadcastConfigRefresh(config);
})().then();
