import { Config } from "common/types";
import { ebsFetch } from "../ebs";
import { openModal } from "./modal";

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
    $redeemContainer.innerHTML = `<div class="redeems-content-spinner"><div class="spinner"></div><p>Loading content...</p></div>`;

    const redeems = await getRedeems(rerender);

    $redeemContainer.innerHTML = "";

    for (const redeem of redeems) {
        const item = document.createElement("div");
        item.className = "redeemable-item";
        item.onclick = () => openModal(redeem);

        const img = document.createElement("img");
        img.src = redeem.image;
        item.appendChild(img);

        const redeemableDescriptor = document.createElement("div");
        redeemableDescriptor.className = "redeemable-item-descriptor";
        item.appendChild(redeemableDescriptor);

        const priceWrapper = document.createElement("div");
        priceWrapper.className = "redeemable-item-price-wrapper";
        redeemableDescriptor.appendChild(priceWrapper);

        const bitsImage = document.createElement("img");
        bitsImage.src = "../img/bits.png";
        priceWrapper.appendChild(bitsImage);

        const price = document.createElement("p");
        price.className = "redeemable-item-price";
        price.textContent = redeem.price.toString();
        priceWrapper.appendChild(price);

        const name = document.createElement("p");
        name.className = "redeemable-item-title";
        name.textContent = redeem.title;
        redeemableDescriptor.appendChild(name);

        $redeemContainer.appendChild(item);
    }
}
