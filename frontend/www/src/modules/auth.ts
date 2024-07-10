import { ebsFetch } from "../util/ebs";
import { renderRedeemButtons } from "./redeems";
import { refreshConfig, setConfig } from "../util/config";
import { twitchAuth } from "../util/twitch";

const $loginPopup = document.getElementById("onboarding")!;
const $loginButton = document.getElementById("twitch-login")!;

document.addEventListener("DOMContentLoaded", () => {
    $loginButton.onclick = async () => {
        const res = await twitchAuth();
        $loginPopup.style.display = "none";
        ebsFetch("public/authorized", {
            method: "POST",
            body: JSON.stringify({ channelId: res.channelId, userId: res.userId }),
        }).then((res) => {
            if (res.status === 403) {
                setBanned(true);
            }
            renderRedeemButtons().then();
        });
    };
});

let _banned = false;
const callbacks: (() => void)[] = [];
export function getBanned() {
    return _banned;
}

export async function setBanned(banned: boolean) {
    if (_banned === banned) return;

    _banned = banned;
    if (banned) {
        callbacks.forEach((c) => c());
        setConfig({ version: -1, message: "You have been banned from using this extension." });
        renderRedeemButtons().then();
    } else {
        await refreshConfig();
        renderRedeemButtons().then();
    }
}
