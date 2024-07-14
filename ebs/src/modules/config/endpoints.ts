import { Webhooks } from "@octokit/webhooks";
import { getConfig, getRawConfigData, sendRefresh } from ".";
import { app } from "../..";
import { asyncCatch } from "../../util/middleware";

const webhooks = new Webhooks({
    secret: process.env.PRIVATE_API_KEY!,
});

app.get(
    "/public/config",
    asyncCatch(async (req, res) => {
        const config = await getConfig();
        res.send(JSON.stringify(config));
    })
);

app.post(
    "/webhook/refresh",
    asyncCatch(async (req, res) => {
        // github webhook
        const signature = req.headers["x-hub-signature-256"] as string;
        const body = JSON.stringify(req.body);

        if (!(await webhooks.verify(body, signature))) {
            res.sendStatus(403);
            return;
        }

        // only refresh if the config.json file was changed
        if (req.body.commits.some((commit: any) => commit.modified.includes("config.json"))) {
            sendRefresh();

            res.status(200).send("Config refreshed.");
        } else {
            res.status(200).send("Config not refreshed.");
        }
    })
);

app.get(
    "/private/refresh",
    asyncCatch(async (_, res) => {
        sendRefresh();

        res.send(await getRawConfigData());
    })
);
