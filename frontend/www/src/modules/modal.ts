import {Cart, Redeem} from "common/types";
import { ebsFetch } from "../ebs";
import {getConfig} from "../config";

const $modal = document.getElementById("modal-confirm")!;
const $modalTitle = document.getElementById("modal-title")!;
const $modalDescription = document.getElementById("modal-description")!;
const $modalImage = document.getElementById("modal-image")! as HTMLImageElement;
const $modalOptions = document.getElementById("modal-options")!;
const $modalToggle = document.getElementById("modal-toggle")!;
const $modalToggleLabel = document.getElementById("modal-toggle-label")!;
const $modalToggleInput = document.getElementById("modal-toggle-input")! as HTMLInputElement;
const $modalText = document.getElementById("modal-text")!;
const $modalTextLabel = document.getElementById("modal-text-label")!;
const $modalTextInput = document.getElementById("modal-text-input")! as HTMLInputElement;
const $modalDropdown = document.getElementById("modal-dropdown")!;
const $modalDropdownLabel = document.getElementById("modal-dropdown-label")!;
const $modalDropdownInput = document.getElementById("modal-dropdown-input")! as HTMLSelectElement;
const $modalPrice = document.getElementById("modal-bits")!;
const $modalYes = document.getElementById("modal-yes")!;
const $modalNo = document.getElementById("modal-no")!;

const $modalProcessing = document.getElementById("modal-processing")!;

const $modalError = document.getElementById("modal-error")!;
const $modalErrorDescription = document.getElementById("modal-error-description")!;
const $modalErrorClose = document.getElementById("modal-error-close")!;

export let cart: Cart | undefined;

document.addEventListener("DOMContentLoaded", () => {
    $modalYes.onclick = confirmPurchase;
    $modalNo.onclick = closeModal;
});

export function openModal(redeem: Redeem) {
    cart = { sku: redeem.sku, id: redeem.id, args: {} };

    $modal.style.display = "flex";
    $modalTitle.textContent = redeem.title;
    $modalDescription.textContent = redeem.description;
    $modalPrice.textContent = redeem.price.toString();
    $modalImage.src = redeem.image;

    hideProcessingModal();
    hideErrorModal();

    if (redeem.toggle || redeem.textbox || redeem.dropdown) {
        $modalOptions.style.display = "block";
    } else {
        $modalOptions.style.display = "none";
    }

    if (redeem.toggle) {
        $modalToggle.style.display = "block";
        $modalToggleLabel.textContent = redeem.toggle;
    } else {
        $modalToggle.style.display = "none";
        $modalToggleLabel.textContent = "";
    }
    if (redeem.textbox) {
        $modalText.style.display = "block";
        $modalTextLabel.textContent = redeem.textbox;
    } else {
        $modalText.style.display = "none";
        $modalTextLabel.textContent = "";
    }
    if (redeem.dropdown) {
        $modalDropdown.style.display = "block";
        $modalDropdownLabel.textContent = redeem.dropdown[0];
        $modalDropdownInput.innerHTML = "";
        for (const option of redeem.dropdown.slice(1)) {
            const element = document.createElement("option");
            element.value = option;
            element.textContent = option;
            $modalDropdownInput.appendChild(element);
        }
    } else {
        $modalDropdown.style.display = "none";
        $modalDropdownLabel.textContent = "";
        $modalDropdownInput.innerHTML = "";
    }
}

export function showProcessingModal() {
    $modalProcessing.style.display = "flex";
}

export function showErrorModal(description: string) {
    $modalError.style.display = "flex";
    $modalErrorDescription.textContent = description;
    $modalErrorClose.onclick = () => hideErrorModal(true);
}

function closeModal() {
    $modal.style.display = "none";
    cart = undefined;
}

export function hideProcessingModal() {
    $modalProcessing.style.display = "none";
}

function hideErrorModal(closeMainModal = false) {
    $modalError.style.display = "none";
    if (closeMainModal) closeModal();
}

async function confirmPurchase() {
    showProcessingModal();

    if (!await confirmVersion()) {
        hideProcessingModal();
        showErrorModal(`Cannot make transaction: Config version mismatch.`);
        return;
    }

    cart!.args.text = $modalTextInput.value;
    cart!.args.dropdown = $modalDropdownInput.value;
    cart!.args.toggle = $modalToggleInput.checked;

    Twitch.ext.bits.useBits(cart!.sku)
}

async function confirmVersion() {
    const config = await getConfig();

    const response = await ebsFetch("/public/confirm_transaction", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            version: config.version,
        } satisfies { version: number }),
    });

    return response.ok;
}