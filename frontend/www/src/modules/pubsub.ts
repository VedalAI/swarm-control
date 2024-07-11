import { BannedData, Config, PubSubMessage } from "common/types";
import { setConfig } from "../util/config";
import { renderRedeemButtons } from "./redeems";
import { strToU8, decompressSync, strFromU8 } from "fflate";
import { getBanned, setBanned } from "./auth";
import { onTwitchAuth } from "../util/twitch";
import { updateClientsideBalance } from "./transaction";

Twitch.ext.listen("global", onPubsubMessage);

let whisperListenTarget: string;
onTwitchAuth((auth) => {
    whisperListenTarget = `whisper-${auth.userId}`;
    console.log(`Listening to ${whisperListenTarget}`);
    Twitch.ext.listen(whisperListenTarget, onPubsubMessage);
});

async function onPubsubMessage(target: string, contentType: string, message: string) {
    const fullMessage = JSON.parse(message) as PubSubMessage;

    console.log(fullMessage);

    switch (fullMessage.type) {
        case "config_refreshed":
            const config = JSON.parse(strFromU8(decompressSync(strToU8(fullMessage.data, true)))) as Config;
            setConfig(config);
            if (!getBanned()) {
                await renderRedeemButtons();
            }
            break;
        case "banned":
            const data = JSON.parse(fullMessage.data) as BannedData;
            const bannedId = data.id;
            if (bannedId === Twitch.ext.viewer.id || bannedId === Twitch.ext.viewer.opaqueId) {
                setBanned(data.banned);
            }
            break;
        case "balance_update":
            const balance = JSON.parse(fullMessage.data) as number;
            updateClientsideBalance(balance);
            break;
    }
}
