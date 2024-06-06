import {openModal} from "./modal";
import {ebsFetch} from "../ebs";
import {Config} from "../common-types";

const $redeemContainer = document.getElementById("buttons")!;

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

export async function getRedeems() {
    if (!config) {
        config = await fetchConfig();
    }

    return config.redeems;
}

document.addEventListener("DOMContentLoaded", () => {
    populateButtons().then();
});

async function populateButtons() {
    const redeems = await getRedeems();

    for (const redeem of redeems) {
        const elem = document.createElement("div");
        elem.className = "elem";
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
