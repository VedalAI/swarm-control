import { Transaction } from "common/types";
import { ebsFetch } from "../util/ebs";
import { hideProcessingModal, openModal, showErrorModal, showSuccessModal, transactionToken } from "./modal";
import { logToDiscord } from "../util/logger";

const $loginPopup = document.getElementById("onboarding")!;
const $loginButton = document.getElementById("twitch-login")!;

document.addEventListener("DOMContentLoaded", () => ($loginButton.onclick = Twitch.ext.actions.requestIdShare));

Twitch.ext.onAuthorized(() => {
    if (Twitch.ext.viewer.id) $loginPopup.style.display = "none";
});

Twitch.ext.bits.onTransactionComplete(async (transaction) => {
    if (!transactionToken) {
        logToDiscord({
            transactionToken: null,
            userIdInsecure: Twitch.ext.viewer.id!,
            important: true,
            fields: [
                {
                    header: "Missing transaction token",
                    content: transaction,
                },
            ],
        }).then();
        await openModal(null);
        hideProcessingModal();
        showErrorModal(
            "An error occurred.",
            "If you made a purchase from another tab/browser/mobile, you can safely ignore this message. Otherwise, please contant a moderator (preferably AlexejheroDev) about this!"
        );
        return;
    }

    logToDiscord({
        transactionToken: transactionToken,
        userIdInsecure: Twitch.ext.viewer.id!,
        important: false,
        fields: [
            {
                header: "Transaction complete",
                content: transaction,
            },
        ],
    }).then();

    const transactionObject: Transaction = {
        token: transactionToken,
        receipt: transaction.transactionReceipt,
    };

    const result = await ebsFetch("/public/transaction", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(transactionObject),
    });

    setTimeout(() => hideProcessingModal(), 250);

    if (result.ok) {
        // Transaction token can no longer be used to log
        showSuccessModal("Purchase completed", `Your transaction was successful! Your redeem will appear on stream soon.\nTransaction ID: ${transactionToken}`);
    } else {
        logToDiscord({
            transactionToken: transactionToken,
            userIdInsecure: Twitch.ext.viewer.id!,
            important: true,
            fields: [
                {
                    header: "Transaction failed (frontend)",
                    content: `${result.status} ${result.statusText} - ${await result.text()}`,
                },
            ],
        }).then();
        showErrorModal(
            "An error occurred.",
            `${result.status} ${result.statusText} - ${await result.text()}\nPlease contact a moderator (preferably AlexejheroDev) about this!\nTransaction ID: ${transactionToken}`
        );
    }
});

Twitch.ext.bits.onTransactionCancelled(async () => {
    if (transactionToken) {
        logToDiscord({
            transactionToken: transactionToken,
            userIdInsecure: Twitch.ext.viewer.id!,
            important: false,
            fields: [
                {
                    header: "Transaction cancelled",
                    content: "User cancelled the transaction.",
                },
            ],
        }).then();
    }
    showErrorModal("Transaction cancelled.", `Transaction ID: ${transactionToken}`);
});
