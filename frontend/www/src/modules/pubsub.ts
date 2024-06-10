import { Config, PubSubMessage } from "common/types";
import { unpack } from "jsonpack";
import { postProcessConfig, setConfig } from "../util/config";
import { renderRedeemButtons } from "./redeems";

Twitch.ext.listen("global", async (_t, _c, message) => {
    const pubSubMessage = JSON.parse(message) as PubSubMessage;

    console.log(pubSubMessage);

    switch (pubSubMessage.type) {
        case "config_refreshed":
            const config = unpack<Config>(pubSubMessage.data);
            await setConfig(postProcessConfig(config));
            await renderRedeemButtons();
            break;
    }
});
