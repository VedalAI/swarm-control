import {ebsFetch} from "./ebs";
import {Config} from "common/types";

let config: Config;

async function fetchConfig() {
    const response = await ebsFetch("/public/config");

    if (!response.ok) {
        if (response.status == 403) {
            return {
                version: -1,
                redeems: [],
                enums: [],
                message: "You cannot use this extension while banned or timed out"
            } satisfies Config;
        } else {
            return {
                version: -1,
                redeems: [],
                enums: [],
                message: `An error occurred while fetching the config\n${response.status} ${response.statusText} - ${await response.text()}`
            } satisfies Config;
        }
    }

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
