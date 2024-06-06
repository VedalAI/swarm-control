import { openModal } from "./modal";
import { ebsFetch } from "../ebs";
import { Config } from "../common-types";

const $redeemContainer = document.getElementById("items")!;

let config: Config;

async function fetchConfig() {
    const response = await ebsFetch("/public/config");
    const data = await response.json();

    return data as Config;
}

export async function getConfigVersion(): Promise<number> {
    if (!config) {
        config = await fetchConfig();
    }

    return config.version;
}

export async function getRedeems(refreshConfig = false) {
    if (!config || refreshConfig) {
        config = await fetchConfig();
    }

    return config.redeems;
}

document.addEventListener("DOMContentLoaded", () => {
    renderRedeemButtons().then();
});

export async function renderRedeemButtons(rerender = false) {
    // TEMP
    Twitch.ext.bits.setUseLoopback(true);

    $redeemContainer.innerHTML = `<div class="redeems-content-spinner"><div class="spinner"></div><p>Loading content...</p></div>`;

    const redeems = await getRedeems(rerender);

    $redeemContainer.innerHTML = "";

    for (const redeem of redeems) {
        const elem = document.createElement("div");
        elem.className = "redeemable-item";
        elem.onclick = () => openModal(redeem);

        const img = document.createElement("img");
        img.src = redeem.image;
        elem.appendChild(img);

        const name = document.createElement("p");
        name.textContent = redeem.title;
        elem.appendChild(name);

        const price = document.createElement("p");
        price.textContent = redeem.price.toString();
        elem.appendChild(price);

        $redeemContainer.appendChild(elem);
    }
}
