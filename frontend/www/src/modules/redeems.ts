import { hideProcessingModal, openModal, showErrorModal } from "./modal";
import { getConfig } from "../util/config";

const $mainContainer = document.getElementsByTagName("main")!;
const $redeemContainer = document.getElementById("items")!;
const $modalProcessing = document.getElementById("modal-processing")!;

export async function renderRedeemButtons() {
    $redeemContainer.innerHTML = `<div class="redeems-content-spinner"><div class="spinner"></div><p>Loading content...</p></div>`;

    const config = await getConfig();
    const redeems = Object.entries(config.redeems || {});

    $redeemContainer.innerHTML = "";

    const alerts = document.getElementsByClassName("alert");
    while (alerts.length > 0) alerts[0].remove();

    if (config.message) $mainContainer[0].insertAdjacentHTML("afterbegin", `<div class="alert">${config.message}</div>`);

    if (redeems.length === 0) $redeemContainer.innerHTML = `<div class="redeems-content-spinner"><p>No content is available.</p></div>`;

    for (const [id, redeem] of redeems) {
        if (redeem.hidden) continue;

        const item = document.createElement("button");
        item.classList.add("redeemable-item");
        if (redeem.disabled) {
            item.classList.add("redeemable-item-disabled");
        }
        item.onclick = () => !redeem.disabled && openModal(redeem);

        const img = document.createElement("img");
        img.src = redeem.image;
        item.appendChild(img);

        const redeemableDescriptor = document.createElement("div");
        redeemableDescriptor.className = "redeemable-item-descriptor";
        item.appendChild(redeemableDescriptor);

        const priceWrapper = document.createElement("div");
        priceWrapper.className = "redeemable-item-price-wrapper";
        item.appendChild(priceWrapper);

        const bitsImage = document.createElement("img");
        bitsImage.src = "img/bits.png";
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

    if ($modalProcessing.style.opacity !== "1") {
        hideProcessingModal();
        showErrorModal("New update!", "The items have been updated, because of this you need to reopen this modal.");
    }
}
