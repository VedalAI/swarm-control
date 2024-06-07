import { Transaction } from "common/types";
import { ebsFetch } from "../ebs";
import {cart, hideProcessingModal, openModal, showErrorModal, showSuccessModal, transactionToken} from "./modal";

const $loginPopup = document.getElementById("onboarding")!;
const $loginButton = document.getElementById("twitch-login")!;

document.addEventListener("DOMContentLoaded", () => $loginButton.onclick = Twitch.ext.actions.requestIdShare);

Twitch.ext.onAuthorized(() => {
    if (Twitch.ext.viewer.id) $loginPopup.style.display = "none";
});

Twitch.ext.bits.onTransactionComplete(async transaction => {
    if (!transactionToken) {
        await openModal(null);
        hideProcessingModal();
        showErrorModal("An error occurred.", "If you made a purchase from another tab/browser/mobile, you can safely ignore this message. Otherwise, please contant a moderator (preferably Alex) about this!");
        return;
    }

    const transactionObject: Transaction = {
        token: transactionToken,
        receipt: transaction.transactionReceipt,
    };

    const result = await ebsFetch("/public/transaction", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(transactionObject),
    });

    setTimeout(() => hideProcessingModal(), 250);

    if (result.ok) showSuccessModal("Purchase completed", "Your transaction was successful!");
    else showErrorModal("An error occurred.", `Please contact a moderator (preferably Alex) about this!\n${result.status} ${result.statusText} - ${await result.text()}`);
});

Twitch.ext.bits.onTransactionCancelled(async () => {
    showErrorModal("Transaction cancelled.", "");
});
