import {Cart, Parameter, Redeem} from "common/types";
import { ebsFetch } from "../ebs";
import {getConfig} from "../config";

const $modal = document.getElementById("modal-confirm")!;
const $modalTitle = document.getElementById("modal-title")!;
const $modalDescription = document.getElementById("modal-description")!;
const $modalImage = document.getElementById("modal-image")! as HTMLImageElement;
const $modalOptions = document.getElementById("modal-options")!;
const $modalOptionsContainer = document.getElementById("modal-options-container")!;
const $modalPrice = document.getElementById("modal-bits")!;
const $modalYes = document.getElementById("modal-yes")!;
const $modalNo = document.getElementById("modal-no")!;

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

    // clear
    for (let node of Array.from($modalOptionsContainer.childNodes))
    {
        $modalOptionsContainer.removeChild(node);
    }
    addOptionsFields($modalOptionsContainer, redeem);
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

function addOptionsFields(modal: HTMLElement, redeem: Redeem)
{
    for (const param of redeem.args) {
        switch (param.type) {
            case "string":
                addText(modal, param);
                break;
            case "integer":
            case "float":
                addNumeric(modal, param);
                break;
            case "boolean":
                addCheckbox(modal, param);
            default:
                addDropdown(modal, param);
        }
    }
}
function addText(modal: HTMLElement, param: Parameter) {
    const field = $paramTemplates.text.div.cloneNode(true) as HTMLSelectElement;
    const input = field.querySelector("input")!;
    const label = field.querySelector("label")!;
    if (param.description) {
        field.title = param.description;
        input.placeholder = param.description;
    }
    field.id += "-"+param.name;
    input.id += "-"+param.name;
    input.onchange = () => cart!.args[param.name] = input.value;
    if (typeof param.defaultValue == "string") {
        input.value = param.defaultValue;
    }
    if (param.required) {
        input.required = true;
        cart!.args[param.name] = input.value;
    }
    label.htmlFor = input.id;
    label.textContent = param.title ?? param.name;
    modal.appendChild(field);
}

function addNumeric(modal: HTMLElement, param: Parameter) {
    const field = $paramTemplates.number.div.cloneNode(true) as HTMLSelectElement;
    const input = field.querySelector("input")!;
    const label = field.querySelector("label")!;
    input.type = "number";
    if (param.type == "integer") {
        input.step = "1";
    } else if (param.type == "float") {
        input.step = "0.01";
    }
    if (param.description) {
        field.title = param.description;
    }
    field.id += "-"+param.name;
    input.id += "-"+param.name;
    input.onchange = () => cart!.args[param.name] = input.value;
    if (typeof param.defaultValue == "number") {
        input.value = param.defaultValue.toString();
    }
    if (param.required) {
        input.required = true;
        cart!.args[param.name] = input.value;
    }
    label.htmlFor = input.id;
    label.textContent = param.title ?? param.name;
    modal.appendChild(field);
}

function addCheckbox(modal: HTMLElement, param: Parameter) {
    const field = $paramTemplates.toggle.div.cloneNode(true) as HTMLSelectElement;
    const input = field.querySelector("input")!;
    const label = field.querySelector("label")!;
    if (param.description) {
        field.title = param.description;
    }
    field.id += "-"+param.name;
    input.id += "-"+param.name;
    input.onchange = () => cart!.args[param.name] = input.checked;
    if (typeof param.defaultValue == "boolean") {
        input.checked = param.defaultValue;
    }
    if (param.required) {
        input.required = true;
        cart!.args[param.name] = input.value;
    }
    label.htmlFor = input.id;
    label.textContent = param.title ?? param.name;
    modal.appendChild(field);
}

async function addDropdown(modal: HTMLElement, param: Parameter) {
    let options: string[] = [];
    try {
        options = (await getConfig()).enums.find(e => e.name == param.type)!.values;
    } catch {
        return; // someone's messing with the config, screw em
    }
    const field = $paramTemplates.dropdown.div.cloneNode(true) as HTMLSelectElement;
    const select = field.querySelector("select")!;
    const label = field.querySelector("label")!;
    field.id += "-"+param.name;
    if (param.description) {
        field.title = param.description;
    }
    select.id += "-"+param.name;
    label.htmlFor = select.id;
    label.textContent = param.title ?? param.name;
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
    if (param.required) {
        select.required = true;
        cart!.args[param.name] = select.value;
    }
    modal.appendChild(field);
}
