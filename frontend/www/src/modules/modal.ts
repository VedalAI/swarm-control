import { Cart, Redeem } from "common/types";
import { ebsFetch } from "../ebs";
import { getConfigVersion, renderRedeemButtons } from "./redeems";

const $modalWrapper = document.getElementById("modal-confirm")!;
const $modal = document.getElementById("modal-confirm")!.getElementsByClassName("modal")[0]!;
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

const $modalSuccess = document.getElementById("modal-success")!;
const $modalSuccessTitle = document.getElementById("modal-success-title")!;
const $modalSuccessDescription = document.getElementById("modal-success-description")!;
const $modalSuccessClose = document.getElementById("modal-success-close")!;

export let cart: Cart | undefined;
let processingTimeout: number | undefined;

document.addEventListener("DOMContentLoaded", () => {
    $modalYes.onclick = confirmPurchase;
    $modalNo.onclick = closeModal;
});

export function openModal(redeem: Redeem) {
    cart = { sku: redeem.sku, id: redeem.id, args: {} };

    $modalWrapper.style.opacity = "1";
    $modalWrapper.style.pointerEvents = "unset";
    $modalTitle.textContent = redeem.title;
    $modalDescription.textContent = redeem.description;
    $modalPrice.textContent = redeem.price.toString();
    $modalImage.src = redeem.image;

    setTimeout(() => $modal.classList.add("active-modal"), 10);

    hideProcessingModal();
    hideErrorModal();

    if (redeem.toggle || redeem.textbox || redeem.dropdown) $modalOptions.style.display = "flex";
    else $modalOptions.style.display = "none";

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
    $modalProcessing.style.opacity = "1";
    $modalProcessing.style.pointerEvents = "unset";
    if (processingTimeout) clearTimeout(processingTimeout);

    processingTimeout = +setTimeout(() => {
        setTimeout(() => hideProcessingModal(), 250);
        showErrorModal("Transaction timed out. Please try again.");
    }, 30 * 1000);
}

export function showErrorModal(description: string, onClose?: () => void) {
    $modalError.style.opacity = "1";
    $modalError.style.pointerEvents = "unset";
    $modalErrorDescription.textContent = description;
    $modalErrorClose.onclick = () => { hideErrorModal(true); onClose?.(); };
}

export function showSuccessModal(title: string, description: string, onClose?: () => void) {
    $modalSuccess.style.opacity = "1";
    $modalSuccess.style.pointerEvents = "unset";
    $modalSuccessTitle.textContent = title;
    $modalSuccessDescription.textContent = description;
    $modalSuccessClose.onclick = () => { hideSuccessModal(true); onClose?.(); };
}

function closeModal() {
    cart = undefined;

    $modal.classList.remove("active-modal");

    setTimeout(() => {
        $modalWrapper.style.opacity = "0";
        $modalWrapper.style.pointerEvents = "none";
    }, 250);
}

export function hideProcessingModal() {
    $modalProcessing.style.opacity = "0";
    $modalProcessing.style.pointerEvents = "none";
    if (processingTimeout) clearTimeout(processingTimeout);
}

function hideErrorModal(closeMainModal = false) {
    $modalError.style.opacity = "0";
    $modalError.style.pointerEvents = "none";
    if (closeMainModal) closeModal();
}

function hideSuccessModal(closeMainModal = false) {
    $modalSuccess.style.opacity = "0";
    $modalSuccess.style.pointerEvents = "none";
    if (closeMainModal) closeModal();
}

async function confirmPurchase() {
    showProcessingModal();

    if (!await confirmVersion()) {
        hideProcessingModal();
        showErrorModal(`Cannot make transaction: Config version mismatch.`, () => renderRedeemButtons(true));
        return;
    }

    cart!.args.text = $modalTextInput.value;
    cart!.args.dropdown = $modalDropdownInput.value;
    cart!.args.toggle = $modalToggleInput.checked;

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
