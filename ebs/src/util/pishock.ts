const apiUrl: string = "https://do.pishock.com/api/apioperate/";

async function sendOperation(op: number, intensity: number, duration: number) {
    try {
        const data = {
            Username: process.env.PISHOCK_USERNAME,
            Apikey: process.env.PISHOCK_APIKEY,
            Code: process.env.PISHOCK_CODE,
            Name: "Swarm Control",

            Op: op,
            Intensity: intensity,
            Duration: duration,
        };

        console.log(`Sending PiShock operation: ${op} ${intensity} ${duration}`);

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            console.error("Failed to send PiShock operation");
            console.error(response.status, await response.text());
            return false;
        }

        return true;
    } catch (e: any) {
        console.error("Failed to send PiShock operation");
        console.error(e);
        return false;
    }
}

export function sendShock(intensity: number, duration: number) {
    return sendOperation(0, intensity, duration);
}
