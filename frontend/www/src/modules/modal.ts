import {Cart} from "../types";
import {ebsFetch} from "../ebs";
import {getConfigVersion, getRedeems} from "./redeems";
import { Redeem } from "../common-types";

const $modal = document.getElementById("modal-confirm")!;
const $modalTitle = document.getElementById("modal-title")!;
const $modalDescription = document.getElementById("modal-description")!;
const $modalImage = document.getElementById("modal-image")! as HTMLImageElement;
const $modalToggle = document.getElementById("modal-toggle")!;
const $modalToggleLabel = document.getElementById("modal-toggle-label")!;
const $modalText = document.getElementById("modal-text")!;
const $modalTextLabel = document.getElementById("modal-text-label")!;
const $modalPrice = document.getElementById("modal-bits")!;
const $modalYes = document.getElementById("modal-yes")!;
const $modalNo = document.getElementById("modal-no")!;

const $modalError = document.getElementById("modal-error")!;
const $modalErrorTitle = document.getElementById("modal-error-title")!;
const $modalErrorDescription = document.getElementById("modal-error-description")!;
const $modalOk = document.getElementById("modal-ok")!;

export let cart: Cart | undefined;

document.addEventListener("DOMContentLoaded", () => {
    $modalYes.onclick = confirmPurchase;
    $modalNo.onclick = closeModal;
    $modalOk.onclick = closeErrorModal;
});

export function openModal(redeem: Redeem) {
    $modal.style.display = "flex";
    $modalTitle.textContent = redeem.title;
    $modalDescription.textContent = redeem.description;
    $modalPrice.textContent = redeem.price.toString();
    $modalImage.src = redeem.image;
    if(redeem.toggle) {
        $modalToggle.style.display = "block";
        $modalToggleLabel.textContent = redeem.toggle;
    } else {
        $modalToggle.style.display = "none";
        $modalToggleLabel.textContent = "";
    }
    if(redeem.textbox) {
        $modalText.style.display = "block";
        $modalTextLabel.textContent = redeem.textbox;
    } else {
        $modalText.style.display = "none";
        $modalTextLabel.textContent = "";
    }
    cart = {sku: redeem.sku, id: redeem.id, args: {}};
}

export function openErrorModal(title: string, description: string) {
    $modalError.style.display = "flex";
    $modalErrorTitle.textContent = title;
    $modalErrorDescription.textContent = description;
}

function closeModal() {
    $modal.style.display = "none";
    cart = undefined;
}

function closeErrorModal() {
    $modalError.style.display = "none";
    cart = undefined;
}

async function confirmPurchase() {
    if (!await confirmVersion()) {
        const element = document.createElement('div');
        element.innerHTML = `CANNOT MAKE TRANSACTION: CONFIG VERSION MISMATCH!`;
        element.style.color = "gold";
        document.body.appendChild(element);
        // TODO: show some kind of error, and then refresh the buttons
        $modal.style.display = "none";
        return;
    }
    // TODO: Update cart args
    Twitch.ext.bits.useBits(cart!.sku)
}

async function confirmVersion() {
    const response = await ebsFetch("/public/confirm_transaction", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            version: await getConfigVersion()
        } satisfies {version: number}),
    });

    return response.ok;
}
