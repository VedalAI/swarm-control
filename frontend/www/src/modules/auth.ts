import { ebsFetch } from "../util/ebs";
import { renderRedeemButtons } from "./redeems";
import { refreshConfig, setConfig } from "../util/config";
import { onTwitchAuth, twitchAuth } from "../util/twitch";
import { clientSession } from "./transaction";

const $loginPopup = document.getElementById("onboarding")!;
const $loginButton = document.getElementById("twitch-login")!;

onTwitchAuth(onAuth);

document.addEventListener("DOMContentLoaded", () => {
    $loginButton.onclick = async () => {
        await twitchAuth();
    };
});

function onAuth(auth: Twitch.ext.Authorized) {
    if (!Twitch.ext.viewer.id) {
        $loginPopup.style.display = "";
        return;
    }
    $loginPopup.style.display = "none";
    ebsFetch("public/authorized", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: clientSession }),
    }).then((res) => {
        if (res.status === 403) {
            setBanned(true);
        }
        renderRedeemButtons().then();
    });
}

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
