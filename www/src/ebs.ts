import {getConfig} from "./config";

export async function ebsFetch(url: string, options: RequestInit = {}) {
    const config = await getConfig();

    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${Twitch.ext.viewer.sessionToken}`);

    return fetch(new URL(url, config.backendUrl), {
        ...options,
        headers,
    });
}
