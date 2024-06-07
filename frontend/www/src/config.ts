import { ebsFetch } from "./ebs";
import { Config } from "common/types";

let config: Config;

async function fetchConfig() {
    const response = await ebsFetch("/public/config");

    if (!response.ok) {
        return {
            version: -1,
            redeems: [],
            enums: [],
            banned: [],
            message: `An error occurred while fetching the config\n${response.status} ${response.statusText} - ${await response.text()}`
        } satisfies Config;
    }

    const config: Config = await response.json();

    if (config.banned && config.banned.includes(Twitch.ext.viewer.id!)) {
        return {
            version: -1,
            redeems: [],
            enums: [],
            banned: [Twitch.ext.viewer.id!],
            message: "You are banned from using this extension"
        } satisfies Config;
    }

    return config;
}

export async function getConfig(): Promise<Config> {
    if (!config) {
        config = await fetchConfig();
    }

    return config;
}

export async function setConfig(newConfig: Config) {
    config = newConfig;
}
