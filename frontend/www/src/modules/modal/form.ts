import { BooleanParam, EnumParam, LiteralTypes, NumericParam, Parameter, Redeem, TextParam, VectorParam } from "common/types";
import { $modalConfirm, cart, showErrorModal } from ".";
import { getConfig } from "../../util/config";

/* Options */
export const $modalOptionsForm = document.getElementById("modal-options-form")! as HTMLFormElement;
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

document.addEventListener("DOMContentLoaded", () => {
    $modalOptionsForm.oninput = checkForm;
    $modalOptionsForm.onsubmit = (e) => {
        e.preventDefault();
        setCartArgsFromForm(e.target as HTMLFormElement);
    };
});

export function setupForm(redeem: Redeem) {
    for (let node of Array.from($modalOptionsForm.childNodes)) $modalOptionsForm.removeChild(node);

    $modalOptions.style.display = (redeem.args || []).length === 0 ? "none" : "flex";

    addOptionsFields($modalOptionsForm, redeem);
}

export function checkForm() {
    $modalConfirm.ariaDisabled = $modalOptionsForm.checkValidity() ? null : "";
}

export function setCartArgsFromForm(form: HTMLFormElement) {
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

export function addOptionsFields(modal: HTMLFormElement, redeem: Redeem) {
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
        option.disabled = name.startsWith("[DISABLED] ");
        option.textContent = name.substring(option.disabled ? 11 : 0);
        select.appendChild(option);
    }
    const firstEnabled = Array.from(select.options).findIndex((op) => !op.disabled);
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
        input.value = Number.isFinite(defVal) ? defVal!.toString() : "0";
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
