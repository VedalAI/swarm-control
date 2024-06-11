import { Config, PubSubMessage } from "common/types";
import { postProcessConfig, setConfig } from "../util/config";
import { renderRedeemButtons } from "./redeems";
import { strToU8, decompressSync, strFromU8 } from "fflate";

Twitch.ext.listen("global", async (_t, _c, message) => {
    const pubSubMessage = JSON.parse(message) as PubSubMessage;

    console.log(pubSubMessage);

    switch (pubSubMessage.type) {
        case "config_refreshed":
            const config = JSON.parse(strFromU8(decompressSync(strToU8(pubSubMessage.data, true)))) as Config;
            // console.log(config);
            await setConfig(postProcessConfig(config));
            await renderRedeemButtons();
            break;
    }
});
