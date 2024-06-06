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

        // TODO (frontend): if redeem is disabled, grey it out and prevent click 🙂

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
