import { Config } from "common/types";
import { sendPubSubMessage } from "../../util/pubsub";
import { compressSync, strFromU8, strToU8 } from "fflate";
import { sendToLogger } from "../../util/logger";

let configData: Config | undefined;
let activeConfig: Config | undefined;
let ingameState = false;

const apiURL = "https://api.github.com/repos/vedalai/swarm-control/contents/config.json";
const rawURL = "https://raw.githubusercontent.com/VedalAI/swarm-control/main/config.json";

require("./endpoints");

(async () => {
    const config = await getConfig();
    await broadcastConfigRefresh(config);
})().then();

async function fetchConfig(): Promise<Config> {
    let url = `${apiURL}?${Date.now()}`;

    try {
        const response = await fetch(url);
        const responseData = await response.json();

        const data: Config = JSON.parse(atob(responseData.content));

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

export function isIngame() {
    return ingameState;
}

export async function setIngame(newIngame: boolean) {
    if (ingameState == newIngame) return;
    ingameState = newIngame;
    await setActiveConfig(await getRawConfigData());
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

export async function getRawConfigData(): Promise<Config> {
    if (!configData) {
        await refreshConfig();
    }

    return configData!;
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

async function refreshConfig() {
    configData = await fetchConfig();
    activeConfig = processConfig(configData);
}

export async function sendRefresh() {
    await refreshConfig();
    console.log("Refreshed config, new config version is ", activeConfig!.version);
    await broadcastConfigRefresh(activeConfig!);
}
