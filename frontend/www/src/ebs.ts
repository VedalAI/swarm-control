const backendUrl = "https://subnautica.vedal.ai";

export async function ebsFetch(url: string, options: RequestInit = {}): Promise<Response> {
    while (!Twitch.ext.viewer.sessionToken) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${Twitch.ext.viewer.sessionToken}`);

    try {
        return await fetch(new URL(url, backendUrl), {
            ...options,
            headers,
        });
    } catch (e: any) {
        console.error(e);
        return new Response(null, { status: 500, statusText: "Internal Server Error" });
    }
}
