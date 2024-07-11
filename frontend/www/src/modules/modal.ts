import { BooleanParam, Cart, EnumParam, LiteralTypes, NumericParam, Parameter, Redeem, TextParam, VectorParam } from "common/types";
import { ebsFetch } from "../util/ebs";
import { getConfig } from "../util/config";
import { logToDiscord } from "../util/logger";
import { setBanned } from "./auth";
import { twitchUseBits } from "../util/twitch";
import { transactionCancelled, transactionComplete } from "./transaction";

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
const $modalConfirm = document.getElementById("modal-confirm")! as HTMLButtonElement;
const $modalCancel = document.getElementById("modal-cancel")! as HTMLButtonElement;

/* Options */
const $modalOptionsForm = document.getElementById("modal-options-form")! as HTMLFormElement;
const $modalOptions = document.getElementById("modal-options")!;
const $paramToggle = document.getElementById("modal-toggle")!;
const $paramText = document.getElementById("modal-text")!;
const $paramNumber = document.getElementById("modal-number")!;
const $paramDropdown = document.getElementById("modal-dropdown")!;
const $paramVector = document.getElementById("modal-vector")!;

const $paramTemplates = {
    text: $paramText,
    number: $paramNumber,
    dropdown: $paramDropdown,
    toggle: $paramToggle,
    vector: $paramVector,
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
export let transactionToken: string | undefined;

let processingTimeout: number | undefined;

document.addEventListener("DOMContentLoaded", () => {
    $modalConfirm.onclick = confirmPurchase;
    $modalCancel.onclick = closeModal;
    $modalOptionsForm.oninput = checkForm;
    $modalOptionsForm.onsubmit = (e) => {
        e.preventDefault();
        setCartArgsFromForm(e.target as HTMLFormElement);
    };

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

    for (let node of Array.from($modalOptionsForm.childNodes)) $modalOptionsForm.removeChild(node);

    $modalOptions.style.display = (redeem.args || []).length === 0 ? "none" : "flex";

    addOptionsFields($modalOptionsForm, redeem);
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

function checkForm() {
    $modalConfirm.ariaDisabled = $modalOptionsForm.checkValidity() ? null : "";
}

function setCartArgsFromForm(form: HTMLFormElement) {
    const formData = new FormData(form);
    formData.forEach((val, name) => {
        const match = /(?<paramName>\w+)\[(?<index>\d{1,2})\]$/.exec(name);
        if (!match?.length) {
            cart!.args[name] = val;
        } else {
            const paramName = match.groups!["paramName"];
            cart!.args[paramName] ??= [];
            const index = parseInt(match.groups!["index"]);
            cart!.args[paramName][index] = val;
        }
    });
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

function addOptionsFields(modal: HTMLFormElement, redeem: Redeem) {
    for (const param of redeem.args || []) {
        switch (param.type) {
            case LiteralTypes.String:
                addText(modal, param);
                break;
            case LiteralTypes.Integer:
            case LiteralTypes.Float:
                addNumeric(modal, param);
                break;
            case LiteralTypes.Boolean:
                addCheckbox(modal, param);
                break;
            case LiteralTypes.Vector:
                addVector(modal, param);
                break;
            default:
                addDropdown(modal, param).then();
                break;
        }
    }
}

function addText(modal: HTMLElement, param: TextParam) {
    const field = $paramTemplates.text.cloneNode(true) as HTMLSelectElement;
    const input = field.querySelector("input")!;
    setupField(field, input, param);
    input.minLength = param.minLength ?? param.required ? 1 : 0;
    input.maxLength = param.maxLength ?? 255;
    if (param.defaultValue !== undefined) {
        input.value = param.defaultValue;
    }
    modal.appendChild(field);
}

function addNumeric(modal: HTMLElement, param: NumericParam) {
    const field = $paramTemplates.number.cloneNode(true) as HTMLSelectElement;
    const input = field.querySelector("input")!;
    input.type = "number";
    if (param.type == LiteralTypes.Integer) {
        input.step = "1";
    } else if (param.type == LiteralTypes.Float) {
        input.step = "0.01";
    }
    input.min = param.min?.toString() ?? "";
    input.max = param.max?.toString() ?? "";
    setupField(field, input, param);

    if (Number.isFinite(param.defaultValue)) input.value = param.defaultValue!.toString();

    modal.appendChild(field);
}

function addCheckbox(modal: HTMLElement, param: BooleanParam) {
    const field = $paramTemplates.toggle.cloneNode(true) as HTMLSelectElement;
    const input = field.querySelector("input")!;
    setupField(field, input, param);
    if (param.defaultValue !== undefined) {
        input.checked = param.defaultValue;
    }
    // browser says "required" means "must be checked"
    input.required = false;
    modal.appendChild(field);
}

async function addDropdown(modal: HTMLElement, param: EnumParam) {
    let options: string[] | undefined = [];

    options = (await getConfig()).enums?.[param.type];
    if (!options) return; // someone's messing with the config, screw em

    const field = $paramTemplates.dropdown.cloneNode(true) as HTMLSelectElement;
    const select = field.querySelector("select")!;

    setupField(field, select, param);
    for (let i = 0; i < options.length; i++) {
        const option = document.createElement("option");
        const name = options[i];
        option.value = i.toString();
        option.disabled = name.startsWith('[DISABLED] ');
        option.textContent = name.substring(option.disabled ? 11 : 0);
        select.appendChild(option);
    }
    const firstEnabled = Array.from(select.options).findIndex(op => !op.disabled);
    if (firstEnabled < 0 || firstEnabled >= select.options.length) {
        console.error(`No enabled options in enum ${param.type}`);
        showErrorModal("Config error", `This redeem is misconfigured, please message AlexejheroDev\nError: ${param.type} has no enabled options`);
        return;
    }

    if (param.defaultValue !== undefined) {
        select.value = param.defaultValue;
    } else {
        select.value = select.options[firstEnabled].value;
    }
    modal.appendChild(field);
}

function addVector(modal: HTMLElement, param: VectorParam) {
    const field = $paramTemplates.vector.cloneNode(true) as HTMLSelectElement;
    const inputs = Array.from(field.querySelectorAll("input")!) as HTMLInputElement[];

    for (let i = 0; i < 3; i++) {
        const input = inputs[i];

        input.step = "1";

        input.min = param.min?.toString() ?? "";
        input.max = param.max?.toString() ?? "";

        setupField(field, input, param, i);

        const defVal = param.defaultValue?.[i];
        input.value = Number.isFinite(defVal)
            ? defVal!.toString()
            : "0";
    }

    modal.appendChild(field);
}

function setupField(field: HTMLElement, inputElem: HTMLSelectElement | HTMLInputElement, param: Parameter, arrayIndex?: number) {
    const label = field.querySelector("label")!;

    field.id += "-" + param.name;

    if (param.description) {
        field.title = param.description;
    }

    inputElem.id += "-" + param.name;
    inputElem.name = param.name.concat(arrayIndex !== undefined ? `[${arrayIndex}]` : "");

    label.id += "-" + param.name;
    label.htmlFor = inputElem.id;
    label.textContent = param.title ?? param.name;

    if (param.required) {
        inputElem.required = true;
        label.ariaRequired = "";
    }
}
