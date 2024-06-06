import { Transaction } from "common/types";
import { ebsFetch } from "../ebs";
import { cart, hideProcessingModal, showErrorModal } from "./modal";
import {getConfig} from "../config";

const $modal = document.getElementById("modal-confirm")!;
const $modalProcessing = document.getElementById("modal-processing")!;
const $loginPopup = document.getElementById("onboarding")!;
const $loginButton = document.getElementById("twitch-login")!;

document.addEventListener("DOMContentLoaded", () => {
    $loginButton.onclick = Twitch.ext.actions.requestIdShare;
});

Twitch.ext.onAuthorized(() => {
    if (Twitch.ext.viewer.id) {
        $loginPopup.style.display = "none";
    }
});

Twitch.ext.bits.onTransactionComplete(async transaction => {
    const config = await getConfig();

    const result = await ebsFetch("/public/transaction", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            ...cart!,
            receipt: transaction.transactionReceipt,
            version: config.version,
        } satisfies Transaction),
    });

    hideProcessingModal();

    if (result.ok) {
        //TODO: showConfirmationModal();
    } else {
        showErrorModal(`${result.status} ${result.statusText} - ${await result.text()}`);
    }
})
