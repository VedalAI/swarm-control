import { Transaction } from "common/types";
import { ebsFetch } from "../util/ebs";
import { hideProcessingModal, openModal, showErrorModal, showSuccessModal, transactionToken } from "./modal";
import { logToDiscord } from "../util/logger";
import { renderRedeemButtons } from "./redeems";
import { refreshConfig, setConfig } from "../util/config";

const $loginPopup = document.getElementById("onboarding")!;
const $loginButton = document.getElementById("twitch-login")!;

document.addEventListener("DOMContentLoaded", () => ($loginButton.onclick = Twitch.ext.actions.requestIdShare));

let _banned = false;
export function getBanned() {
    return _banned;
}

export async function setBanned(banned: boolean) {
    if (_banned === banned) return;

    _banned = banned;
    if (banned) {
        setConfig({ version: -1, message: "You have been banned from using this extension." });
        renderRedeemButtons().then();
    } else {
        await refreshConfig();
        renderRedeemButtons().then();
    }
}

Twitch.ext.onAuthorized(() => {
    $loginPopup.style.display = Twitch.ext.viewer.id ? "none" : "";
    if (Twitch.ext.viewer.id) {
        ebsFetch("public/authorized", {
            method: "POST",
            body: JSON.stringify({ userId: Twitch.ext.viewer.id }),
        }).then((res) => {
            if (res.status === 403) {
                setBanned(true);
            }
            renderRedeemButtons().then();
        });
    }
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

    const text = await result.text();
    if (result.ok) {
        // Transaction token can no longer be used to log
        showSuccessModal("Purchase completed", `${text}\nTransaction ID: ${transactionToken}`);
    } else {
        const errorText = `${result.status} ${result.statusText} - ${text}`;
        logToDiscord({
            transactionToken: transactionToken,
            userIdInsecure: Twitch.ext.viewer.id!,
            important: true,
            fields: [
                {
                    header: "Transaction failed (frontend)",
                    content: errorText,
                },
            ],
        }).then();
        showErrorModal(
            "An error occurred.",
            `${errorText}\nPlease contact a moderator (preferably AlexejheroDev) about this!\nTransaction ID: ${transactionToken}`
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

        await ebsFetch("/public/transaction/cancel", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ token: transactionToken }),
        });
    }

    hideProcessingModal();
    showErrorModal("Transaction cancelled.", `Transaction ID: ${transactionToken}`);
});
