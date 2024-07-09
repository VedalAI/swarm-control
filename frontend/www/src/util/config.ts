import { ebsFetch } from "./ebs";
import { Config } from "common/types";

let config: Config;

const emptyConfig: Config = {
    version: -1,
    redeems: {},
    enums: {},
};

async function fetchConfig() {
    const response = await ebsFetch("/public/config");

    if (!response.ok) {
        return {
            ...emptyConfig,
            message: `An error occurred while fetching the config\n${response.status} ${response.statusText} - ${await response.text()}`,
        } satisfies Config;
    }

    const config: Config = await response.json();

    return config;
}

export async function refreshConfig() {
    config = await fetchConfig();
}

export async function getConfig(): Promise<Config> {
    if (!config) {
        config = await fetchConfig();
    }

    return config;
}

export function setConfig(newConfig: Config) {
    config = newConfig;
}
