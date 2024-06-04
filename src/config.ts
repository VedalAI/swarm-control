import {Config} from "./types";

let config: Config;

const gistUrl = "https://gist.githubusercontent.com/Alexejhero/804fe0900d015b89a934a9b759ba2330/raw"

async function fetchConfig() {
    const url = `${gistUrl}?${Date.now()}`;

    const response = await fetch(url);
    const data = await response.json();

    return data as Config;
}

export async function getConfig() {
    if (!config) {
        config = await fetchConfig();
    }

    return config;
}
