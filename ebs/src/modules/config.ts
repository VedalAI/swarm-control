import { Config } from "common/types";
import { app } from "..";
import { sendPubSubMessage } from "../util/pubsub";
import { compressSync, strFromU8, strToU8 } from "fflate";
import { asyncCatch } from "../util/middleware";
import { Webhooks } from "@octokit/webhooks";
import { sendToLogger } from "../util/logger";

let activeConfig: Config | undefined;
let configData: Config | undefined;

const apiURL = "https://api.github.com/repos/vedalai/swarm-control/contents/config.json";
const rawURL = "https://raw.githubusercontent.com/VedalAI/swarm-control/main/config.json";

async function fetchConfig(): Promise<Config> {
    let url = `${apiURL}?${Date.now()}`;

    try {
        const response = await fetch(url);
        const responseData = await response.json();

        const data: Config = JSON.parse(atob(responseData.content))

        return data;
    } catch (e: any) {
        console.error("Error when fetching config from api URL, falling back to raw URL");
        console.error(e);

        sendToLogger({
            transactionToken: null,
            userIdInsecure: null,
            important: true,
            fields: [
                {
                    header: "Error when fetching config from api URL, falling back to raw URL",
                    content: e.toString(),
                },
            ],
        }).then();

        try {
            url = `${rawURL}?${Date.now()}`;
            const response = await fetch(url);
            const data: Config = await response.json();
    
            return data;
        } catch (e: any) {
            console.error("Error when fetching config from raw URL, panic");
            console.error(e);
    
            sendToLogger({
                transactionToken: null,
                userIdInsecure: null,
                important: true,
                fields: [
                    {
                        header: "Error when fetching config from raw URL, panic",
                        content: e.toString(),
                    },
                ],
            }).then();
    
            return {
                version: -1,
                message: "Error when fetching config from raw URL, panic",
            };
        }
    }

}

function processConfig(data: Config) {
    const config: Config = JSON.parse(JSON.stringify(data));
    if (!ingameState) {
        Object.values(config.redeems!).forEach((redeem) => (redeem.disabled = true));
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
    await broadcastConfigRefresh(activeConfig);
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
    setActiveConfig(configData!).then();
}

async function refreshConfig() {
    configData = await fetchConfig();
    activeConfig = processConfig(configData);
}

app.get(
    "/private/refresh",
    asyncCatch(async (_, res) => {
        sendRefresh();

        res.send(configData);
    })
);

const webhooks = new Webhooks({
    secret: process.env.PRIVATE_API_KEY!,
});

app.post(
    "/webhook/refresh",
    asyncCatch(async (req, res) => {
        // github webhook
        const signature = req.headers["x-hub-signature-256"] as string;
        const body = JSON.stringify(req.body);

        if (!(await webhooks.verify(body, signature))) {
            res.sendStatus(403);
            return;
        }

        // only refresh if the config.json file was changed
        if (req.body.commits.some((commit: any) => commit.modified.includes("config.json"))) {
            sendRefresh();

            res.status(200).send("Config refreshed.");
        } else {
            res.status(200).send("Config not refreshed.");
        }
    })
);

async function sendRefresh() {
    await refreshConfig();
    console.log("Refreshed config, new config version is ", activeConfig!.version);
    await broadcastConfigRefresh(activeConfig!);
}

app.get(
    "/public/config",
    asyncCatch(async (req, res) => {
        const config = await getConfig();
        res.send(JSON.stringify(config));
    })
);

(async () => {
    const config = await getConfig();
    await broadcastConfigRefresh(config);
})().then();
