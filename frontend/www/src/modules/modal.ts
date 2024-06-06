import { Cart } from "../types";
import { ebsFetch } from "../ebs";
import { getConfigVersion, getRedeems, renderRedeemButtons } from "./redeems";
import { Redeem } from "../common-types";

const $modal = document.getElementById("modal-confirm")!;
const $modalTitle = document.getElementById("modal-title")!;
const $modalDescription = document.getElementById("modal-description")!;
const $modalImage = document.getElementById("modal-image")! as HTMLImageElement;
const $modalOptions = document.getElementById("modal-options")!;
const $modalToggle = document.getElementById("modal-toggle")!;
const $modalToggleLabel = document.getElementById("modal-toggle-label")!;
const $modalToggleInput = document.getElementById("modal-toggle-input")!;
const $modalText = document.getElementById("modal-text")!;
const $modalTextLabel = document.getElementById("modal-text-label")!;
const $modalTextInput = document.getElementById("modal-text-input")!;
const $modalDropdown = document.getElementById("modal-dropdown")!;
const $modalDropdownLabel = document.getElementById("modal-dropdown-label")!;
const $modalDropdownInput = document.getElementById("modal-dropdown-input")!;
const $modalPrice = document.getElementById("modal-bits")!;
const $modalYes = document.getElementById("modal-yes")!;
const $modalNo = document.getElementById("modal-no")!;

const $modalProcessing = document.getElementById("modal-processing")!;

const $modalError = document.getElementById("modal-error")!;
const $modalErrorDescription = document.getElementById("modal-error-description")!;
const $modalErrorClose = document.getElementById("modal-error-close")!;

/* const $modalError = document.getElementById("modal-error")!;
const $modalErrorTitle = document.getElementById("modal-error-title")!;
const $modalErrorDescription = document.getElementById("modal-error-description")!;
const $modalOk = document.getElementById("modal-ok")!; */

export let cart: Cart | undefined;

document.addEventListener("DOMContentLoaded", () => {
    $modalYes.onclick = confirmPurchase;
    $modalNo.onclick = closeModal;
    // $modalOk.onclick = closeErrorModal;
});

export function openModal(redeem: Redeem) {
    $modal.style.display = "flex";
    $modalTitle.textContent = redeem.title;
    $modalDescription.textContent = redeem.description;
    $modalPrice.textContent = redeem.price.toString();
    $modalImage.src = redeem.image;

    closeProcessingModal();
    closeErrorModal();

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
    cart = { sku: redeem.sku, id: redeem.id, args: {} };
}

export function openProcessingModal() {
    $modalProcessing.style.display = "flex";
}

export function openErrorModal(description: string, onClose?: () => void) {
    $modalError.style.display = "flex";
    $modalErrorDescription.textContent = description;
    $modalErrorClose.onclick = () => { closeErrorModal(true); onClose?.(); };
}

function closeModal() {
    $modal.style.display = "none";
    cart = undefined;
}

export function closeProcessingModal() {
    $modalProcessing.style.display = "none";
}

function closeErrorModal(closeMainModal = false) {
    $modalError.style.display = "none";
    if (closeMainModal) closeModal();
}

async function confirmPurchase() {
    if (!await confirmVersion()) {
        /* const element = document.createElement('div');
        element.innerHTML = `CANNOT MAKE TRANSACTION: CONFIG VERSION MISMATCH!`;
        element.style.color = "gold";
        document.body.appendChild(element);
        // TODO: show some kind of error, and then refresh the buttons
        $modal.style.display = "none"; */
        openErrorModal(`Cannot make transaction: Config version mismatch.`, () => renderRedeemButtons(true));
        return;
    }

    openProcessingModal();

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
        } satisfies { version: number }),
    });

    return response.ok;
}
