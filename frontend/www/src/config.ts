import {ebsFetch} from "./ebs";
import {Config} from "common/types";

let config: Config;

async function fetchConfig() {
    const response = await ebsFetch("/public/config");
    const data = await response.json();

    return data as Config;
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
