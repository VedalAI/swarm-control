import { Cart, Redeem } from "common/types";
import { ebsFetch } from "../../util/ebs";
import { getConfig } from "../../util/config";
import { logToDiscord } from "../../util/logger";
import { setBanned } from "../auth";
import { twitchUseBits } from "../../util/twitch";
import { transactionCancelled, transactionComplete } from "../transaction";
import { $modalOptionsForm, checkForm, setCartArgsFromForm, setupForm } from "./form";

document.body.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    e.preventDefault();
});

/* Containers */
const $modalWrapper = document.getElementById("modal-wrapper")!;
const $modal = document.getElementById("modal-wrapper")!.getElementsByClassName("modal")[0]!;
const $modalInsideWrapper = $modal.getElementsByClassName("modal-inside-wrapper")[0]!;

/* Descriptors */
const $modalTitle = document.getElementById("modal-title")!;
const $modalDescription = document.getElementById("modal-description")!;
const $modalImage = document.getElementById("modal-image")! as HTMLImageElement;

/* Price */
const $modalPrice = document.getElementById("modal-bits")!;

/* Buttons */
export const $modalConfirm = document.getElementById("modal-confirm")! as HTMLButtonElement;
export const $modalCancel = document.getElementById("modal-cancel")! as HTMLButtonElement;

/* Modal overlays */
const $modalProcessing = document.getElementById("modal-processing")!;
const $modalProcessingDescription = document.getElementById("modal-processing-description")!;
const $modalProcessingClose = document.getElementById("modal-processing-close")!;

const $modalError = document.getElementById("modal-error")!;
const $modalErrorTitle = document.getElementById("modal-error-title")!;
const $modalErrorDescription = document.getElementById("modal-error-description")!;
const $modalErrorClose = document.getElementById("modal-error-close")!;

const $modalSuccess = document.getElementById("modal-success")!;
const $modalSuccessTitle = document.getElementById("modal-success-title")!;
const $modalSuccessDescription = document.getElementById("modal-success-description")!;
const $modalSuccessClose = document.getElementById("modal-success-close")!;

export let cart: Cart | undefined;
export let transactionToken: string | undefined;

let processingTimeout: number | undefined;

document.addEventListener("DOMContentLoaded", () => {
    $modalConfirm.onclick = confirmPurchase;
    $modalCancel.onclick = closeModal;

    $modalWrapper.onclick = (e) => {
        if (e.target !== $modalWrapper) return;
        if ($modalProcessing.style.opacity == "1") return;

        closeModal();
    };
});

export async function openModal(redeem: Redeem | null) {
    if (redeem == null) {
        $modalWrapper.style.opacity = "1";
        $modalWrapper.style.pointerEvents = "unset";
        setTimeout(() => $modal.classList.add("active-modal"), 10);
        return;
    }
    if (redeem.disabled) return;

    const config = await getConfig();

    cart = { version: config.version, sku: redeem.sku, id: redeem.id, args: {} };

    $modalWrapper.style.opacity = "1";
    $modalWrapper.style.pointerEvents = "unset";

    $modalTitle.textContent = redeem.title;
    $modalDescription.textContent = redeem.description;
    $modalPrice.textContent = redeem.price.toString();
    $modalImage.src = redeem.image;

    // scroll to top of modal
    $modalInsideWrapper.scrollTop = 0;

    setTimeout(() => $modal.classList.add("active-modal"), 10);

    hideProcessingModal();
    hideSuccessModal();
    hideErrorModal();

    setupForm(redeem);
    checkForm();
}

export function showProcessingModal() {
    $modalProcessing.style.opacity = "1";
    $modalProcessing.style.pointerEvents = "unset";

    $modalProcessingDescription.style.display = "none";
    $modalProcessingClose.style.display = "none";

    if (processingTimeout) clearTimeout(processingTimeout);

    processingTimeout = +setTimeout(() => {
        $modalProcessingDescription.style.display = "unset";
        $modalProcessingDescription.textContent = "This is taking longer than expected.";

        $modalProcessingClose.style.display = "unset";
        $modalProcessingClose.onclick = () => {
            hideProcessingModal();
            closeModal();
        };
    }, 30 * 1000);
}

export function showErrorModal(title: string, description: string) {
    $modalError.style.opacity = "1";
    $modalError.style.pointerEvents = "unset";
    $modalErrorTitle.textContent = title;
    $modalErrorDescription.innerText = description;
    $modalErrorClose.onclick = () => hideErrorModal(true);
}

export function showSuccessModal(title: string, description: string, onClose?: () => void) {
    $modalSuccess.style.opacity = "1";
    $modalSuccess.style.pointerEvents = "unset";
    $modalSuccessTitle.textContent = title;
    $modalSuccessDescription.innerText = description;
    $modalSuccessClose.onclick = () => {
        hideSuccessModal(true);
        onClose?.();
    };
}

function closeModal() {
    cart = undefined;
    transactionToken = undefined;

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
    setCartArgsFromForm($modalOptionsForm);
    if (!$modalOptionsForm.reportValidity()) {
        return;
    }
    showProcessingModal();

    if (!(await prePurchase())) {
        return;
    }

    logToDiscord({
        transactionToken: transactionToken!,
        userIdInsecure: Twitch.ext.viewer.id!,
        important: false,
        fields: [{ header: "Transaction started", content: cart }],
    }).then();

    const res = await twitchUseBits(cart!.sku);
    if (res === "cancelled") {
        await transactionCancelled();
    } else {
        await transactionComplete(res);
    }
}

async function prePurchase() {
    const response = await ebsFetch("/public/prepurchase", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(cart),
    });

    if (!response.ok) {
        hideProcessingModal();
        if (response.status == 403) {
            setBanned(true);
            showErrorModal("You are banned from using this extension.", `${response.status} ${response.statusText} - ${await response.text()}\n`);
        } else {
            showErrorModal(
                "Invalid transaction, please try again.",
                `${response.status} ${response.statusText} - ${await response.text()}\nIf this problem persists, please refresh the page or contact a moderator (preferably AlexejheroDev).`
            );
        }
        return false;
    }

    transactionToken = await response.text();

    return true;
}