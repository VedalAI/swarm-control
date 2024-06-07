import { Cart, Parameter, Redeem } from "common/types";
import { ebsFetch } from "../ebs";
import { getConfig } from "../config";

/* Containers */
const $modalWrapper = document.getElementById("modal-wrapper")!;
const $modal = document.getElementById("modal-wrapper")!.getElementsByClassName("modal")[0]!;

/* Descriptors */
const $modalTitle = document.getElementById("modal-title")!;
const $modalDescription = document.getElementById("modal-description")!;
const $modalImage = document.getElementById("modal-image")! as HTMLImageElement;

/* Price */
const $modalPrice = document.getElementById("modal-bits")!;

/* Buttons */
const $modalConfirm = document.getElementById("modal-confirm")!;
const $modalCancel = document.getElementById("modal-cancel")!;

/* Options */
const $modalOptionsContainer = document.getElementById("modal-options-container")!;
const $modalOptionsWrapper = document.getElementById("modal-options")!;
const $paramToggle = document.getElementById("modal-toggle")!;
const $paramText = document.getElementById("modal-text")!;
const $paramNumber = document.getElementById("modal-number")!;
const $paramDropdown = document.getElementById("modal-dropdown")!;

const $paramTemplates = {
    text: {
        div: $paramText,
        label: $paramText.querySelector("label"),
        input: $paramText.querySelector("input")
    },
    number: {
        div: $paramNumber,
        label: $paramNumber.querySelector("label"),
        input: $paramNumber.querySelector("input")
    },
    dropdown: {
        div: $paramDropdown,
        label: $paramDropdown.querySelector("label"),
        input: $paramDropdown.querySelector("select")
    },
    toggle: {
        div: $paramToggle,
        label: $paramToggle.querySelector("label"),
        input: $paramToggle.querySelector("input")
    },
};

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
let processingTimeout: number | undefined;

document.addEventListener("DOMContentLoaded", () => {
    $modalConfirm.onclick = confirmPurchase;
    $modalCancel.onclick = closeModal;
});

export function openModal(redeem: Redeem | null) {
    if (redeem == null) {
        $modalWrapper.style.opacity = "1";
        $modalWrapper.style.pointerEvents = "unset";
        setTimeout(() => $modal.classList.add("active-modal"), 10);
        return;
    }

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

    for (let node of Array.from($modalOptionsContainer.childNodes)) $modalOptionsContainer.removeChild(node);

    if ((redeem.args || []).length === 0) $modalOptionsWrapper.style.display = "none";
    else $modalOptionsWrapper.style.display = "flex";

    addOptionsFields($modalOptionsContainer, redeem);
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
        $modalProcessingClose.onclick = () => { hideProcessingModal(); closeModal(); };
    }, 30 * 1000);
}

export function showErrorModal(title: string, description: string) {
    $modalError.style.opacity = "1";
    $modalError.style.pointerEvents = "unset";
    $modalErrorTitle.textContent = title;
    $modalErrorDescription.textContent = description;
    $modalErrorClose.onclick = () => hideErrorModal(true);
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
        showErrorModal("Verification failed, please try again.", "Your redeems list is out-of-date. Please try again. If this problem persists, please refresh the page.");
        return;
    }

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

function addOptionsFields(modal: HTMLElement, redeem: Redeem) {
    for (const param of redeem.args || []) switch (param.type) {
        case "string":
            addText(modal, param);
            break;
        case "integer":
        case "float":
            addNumeric(modal, param);
            break;
        case "boolean":
            addCheckbox(modal, param);
            break;
        default:
            addDropdown(modal, param).then();
            break;
    }
}
function addText(modal: HTMLElement, param: Parameter) {
    const field = $paramTemplates.text.div.cloneNode(true) as HTMLSelectElement;
    const input = field.querySelector("input")!;
    setupField(field, "input", param);
    input.onchange = () => cart!.args[param.name] = input.value;
    if (typeof param.defaultValue == "string") {
        input.value = param.defaultValue;
    }
    postSetupField(input, param);
    modal.appendChild(field);
}

function addNumeric(modal: HTMLElement, param: Parameter) {
    const field = $paramTemplates.number.div.cloneNode(true) as HTMLSelectElement;
    const input = field.querySelector("input")!;
    input.type = "number";
    if (param.type == "integer") {
        input.step = "1";
    } else if (param.type == "float") {
        input.step = "0.01";
    }
    setupField(field, "input", param);
    input.onchange = () => cart!.args[param.name] = input.value;

    if (typeof param.defaultValue == "number")
        input.value = param.defaultValue.toString();

    postSetupField(input, param);
    modal.appendChild(field);
}

function addCheckbox(modal: HTMLElement, param: Parameter) {
    const field = $paramTemplates.toggle.div.cloneNode(true) as HTMLSelectElement;
    const input = field.querySelector("input")!;
    setupField(field, "input", param);
    input.onchange = () => cart!.args[param.name] = input.checked;
    if (typeof param.defaultValue == "boolean") {
        input.checked = param.defaultValue;
    }
    postSetupField(input, param);
    modal.appendChild(field);
}

async function addDropdown(modal: HTMLElement, param: Parameter) {
    let options: string[] = [];

    try {
        options = (await getConfig()).enums!.find(e => e.name == param.type)!.values;
    } catch {
        return; // someone's messing with the config, screw em
    }

    const field = $paramTemplates.dropdown.div.cloneNode(true) as HTMLSelectElement;
    const select = field.querySelector("select")!;

    setupField(field, "select", param);
    for (const opt of options) {
        const option = document.createElement("option");
        option.value = opt;
        option.textContent = opt;
        select.appendChild(option);
    }

    select.onchange = () => cart!.args[param.name] = select.value;
    if (typeof param.defaultValue == "string") {
        select.value = param.defaultValue;
    } else {
        select.value = select.options[0].value;
    }
    postSetupField(select, param);
    modal.appendChild(field);
}

function setupField(field: HTMLElement, inputType: "select" | "input", param: Parameter) {
    const input = field.querySelector(inputType)!;
    const label = field.querySelector("label")!;
    field.id += "-"+param.name;
    if (param.description) {
        field.title = param.description;
    }
    input.id += "-"+param.name;
    label.id += "-"+param.name;
    label.htmlFor = input.id;
    label.textContent = param.title ?? param.name;
}

function postSetupField(input: HTMLSelectElement | HTMLInputElement, param: Parameter) {
    if (param.required) {
        input.required = true;
        cart!.args[param.name] = input.value;
    }
}
