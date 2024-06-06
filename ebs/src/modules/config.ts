import { Config } from "common/types";
import { app } from "../index";

let config: Config | undefined;
let previousConfig: Config | undefined;
let previousConfigUsableUntil: Date | undefined;

const gistUrl = "https://gist.githubusercontent.com/Alexejhero/804fe0900d015b89a934a9b759ba2330/raw"

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
    console.log("Refreshed config, new config version is ", config.version)
    res.sendStatus(200);
});

app.get("/public/config", async (_, res) => {
    const config = await getConfig();
    res.send(JSON.stringify(config));
});
