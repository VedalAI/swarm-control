const backendUrl = "http://localhost:3000/";// "https://subnautica.neurosama.com/";

export async function ebsFetch(url: string, options: RequestInit = {}) {
    while (!Twitch.ext.viewer.sessionToken) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${Twitch.ext.viewer.sessionToken}`);

    return fetch(new URL(url, backendUrl), {
        ...options,
        headers,
    });
}
