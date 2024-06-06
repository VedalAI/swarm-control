import { Transaction } from "common/types";
import { ebsFetch } from "../ebs";
import { cart, hideProcessingModal, showErrorModal } from "./modal";
import { getConfigVersion } from "./redeems";

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
    const result = await ebsFetch("/public/transaction", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            ...cart!,
            receipt: transaction.transactionReceipt,
            version: await getConfigVersion(),
        } satisfies Transaction),
    });

    hideProcessingModal();

    // TODO: make this look nice \/
    if (result.ok) {
        //TODO: showConfirmationModal();
    } else {
        /* const element = document.createElement('div');
        element.innerHTML = `FAIL ${result.status} ${result.statusText}! ${await result.text()}`;
        element.style.color = "red";
        document.body.appendChild(element); */
        showErrorModal(`${result.status} ${result.statusText} - ${await result.text()}`);
    }
})
