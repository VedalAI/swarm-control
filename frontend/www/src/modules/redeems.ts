import { openModal } from "./modal";
import {getConfig} from "../config";

const $redeemContainer = document.getElementById("items")!;

document.addEventListener("DOMContentLoaded", () => {
    renderRedeemButtons().then();
});

export async function renderRedeemButtons() {
    $redeemContainer.innerHTML = `<div class="redeems-content-spinner"><div class="spinner"></div><p>Loading content...</p></div>`;

    const config = await getConfig();
    const redeems = config.redeems;

    $redeemContainer.innerHTML = "";

    for (const redeem of redeems) {
        if (redeem.hidden) continue;

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
