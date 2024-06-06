import {Config, PubSubMessage} from "common/types";
import {unpack} from "jsonpack";
import {setConfig} from "../config";
import {renderRedeemButtons} from "./redeems";

Twitch.ext.listen("global", async (_, __, message) => {
    const pubSubMessage = JSON.parse(message) as PubSubMessage;
    console.log(pubSubMessage);
    switch (pubSubMessage.type) {
        case "config_refreshed":
            const config = unpack<Config>(pubSubMessage.data);
            await setConfig(config);
            await renderRedeemButtons();
            break;
    }
});
