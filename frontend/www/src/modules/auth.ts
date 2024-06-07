import { Transaction } from "common/types";
import { ebsFetch } from "../ebs";
import { cart, hideProcessingModal, showErrorModal, showSuccessModal } from "./modal";
import { getConfig } from "../config";
import { pack } from "jsonpack";

const $loginPopup = document.getElementById("onboarding")!;
const $loginButton = document.getElementById("twitch-login")!;

document.addEventListener("DOMContentLoaded", () => $loginButton.onclick = Twitch.ext.actions.requestIdShare);

Twitch.ext.onAuthorized(() => {
    if (Twitch.ext.viewer.id) $loginPopup.style.display = "none";
});

Twitch.ext.bits.onTransactionComplete(async transaction => {
    const config = await getConfig();

    const transactionObject: Transaction = {
        ...cart!,
        receipt: transaction.transactionReceipt,
        version: config.version,
    };

    const result = await ebsFetch("/public/transaction", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(transactionObject),
    });

    if (!result.ok) {
        hideProcessingModal();
        showErrorModal("An error occurred while fulfilling your purchase. Please contant a moderator and send them the following error code: "
            + Buffer.from(pack(transactionObject)).toString("base64"));
        return;
    }

    setTimeout(() => hideProcessingModal(), 250);

    if (result.ok) showSuccessModal("Purchase completed", "Your transaction was successful!");
    else showErrorModal(`${result.status} ${result.statusText} - ${await result.text()}`);
});

Twitch.ext.bits.onTransactionCancelled(async () => {
    showErrorModal("Transaction cancelled.");
});
