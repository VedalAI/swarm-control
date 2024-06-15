import { Config } from "common/types";
import { app } from "../index";
import { sendPubSubMessage } from "../util/pubsub";
import { strToU8, compressSync, strFromU8 } from "fflate";
import { getBannedUsers } from "../util/db";
import { asyncCatch } from "../util/middleware";
import { Webhooks } from "@octokit/webhooks";

let activeConfig: Config | undefined;
let configData: Config | undefined;

const gistUrl = "https://raw.githubusercontent.com/VedalAI/swarm-control/main/config.json";

async function fetchConfig(): Promise<Config> {
    const url = `${gistUrl}?${Date.now()}`;

    try {
        const response = await fetch(url);
        const data: Config = await response.json();

        console.log(data);

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

function processConfig(data: Config) {
    const config: Config = JSON.parse(JSON.stringify(data));
    if (!ingameState) {
        Object.values(config.redeems!)
            .forEach((redeem) => (redeem.disabled = true));
    }
    return config;
}

export async function getConfig(): Promise<Config> {
    if (!configData) {
        await refreshConfig();
    }

    return activeConfig!;
}

export async function setActiveConfig(data: Config) {
    activeConfig = processConfig(data);
    broadcastConfigRefresh(activeConfig);
}

export async function broadcastConfigRefresh(config: Config) {
    return sendPubSubMessage({
        type: "config_refreshed",
        data: strFromU8(compressSync(strToU8(JSON.stringify(config))), true),
    });
}

let ingameState: boolean = false;

export function isIngame() {
    return ingameState;
}

export function setIngame(newIngame: boolean) {
    if (ingameState == newIngame) return;
    ingameState = newIngame;
    setActiveConfig(configData!);
}

async function refreshConfig() {
    configData = await fetchConfig();
    activeConfig = processConfig(configData);
}

app.get("/private/refresh", asyncCatch(async (_, res) => {
    await refreshConfig();
    console.log("Refreshed config, new config version is ", activeConfig!.version);
    await broadcastConfigRefresh(activeConfig!);
    res.sendStatus(200);
}));

const webhooks = new Webhooks({
    secret: process.env.PRIVATE_API_KEY!,
});

app.post("/webhook/refresh", asyncCatch(async (req, res) => {
    // github webhook
    const signature = req.headers["x-hub-signature-256"] as string;
    const body = JSON.stringify(req.body);

    if(!(await webhooks.verify(body, signature))) {
        res.sendStatus(403);
        return;
    }

    // only refresh if the config.json file was changed
    if(req.body.commits.some((commit: any) => commit.modified.includes("config.json"))) {
        await refreshConfig();
        console.log("Refreshed config, new config version is ", activeConfig!.version);
        await broadcastConfigRefresh(activeConfig!);

        res.status(200).send("Config refreshed.");
    } else {
        res.status(200).send("Config not refreshed.");
    }
}));

app.get("/public/config", asyncCatch(async (req, res) => {
    const config = await getConfig();
    res.send(JSON.stringify(config));
}));

(async () => {
    const config = await getConfig();
    await broadcastConfigRefresh(config);
})().then();
