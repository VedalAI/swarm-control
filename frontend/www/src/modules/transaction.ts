import { Transaction } from "common/types";
import { hideProcessingModal, openModal, showErrorModal, showSuccessModal, transactionToken, transactionTokenJwt } from "./modal";
import { logToDiscord } from "../util/logger";
import { ebsFetch } from "../util/ebs";
import { twitchUseBits } from "../util/twitch";

type TransactionResponse = Twitch.ext.BitsTransaction | "useCredit" | "cancelled";

let myCredit = 0;
export const clientSession = Math.random().toString(36).substring(2);

export async function promptTransaction(sku: string, cost: number): Promise<TransactionResponse> {
    console.log(`Purchasing ${sku} for ${cost} bits (have ${myCredit})`);
    if (myCredit >= cost) {
        return (await confirmCreditTransaction(cost)) ? "useCredit" : "cancelled";
    } else {
        return await twitchUseBits(sku);
    }
}

export async function transactionComplete(transaction: Twitch.ext.BitsTransaction | "useCredit") {
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
    const isCredit = transaction === "useCredit";

    logToDiscord({
        transactionToken: transactionToken.id,
        userIdInsecure: Twitch.ext.viewer.id!,
        important: false,
        fields: [
            {
                header: "Transaction complete",
                content: isCredit ? { creditLeft: myCredit } : transaction,
            },
        ],
    }).then();

    const result = await ebsFetch("/public/transaction", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            token: transactionTokenJwt!,
            clientSession,
            ...(isCredit ? { type: "credit" } : { type: "bits", receipt: transaction.transactionReceipt }),
        } satisfies Transaction),
    });

    setTimeout(() => hideProcessingModal(), 250);

    const text = await result.text();
    if (result.ok) {
        showSuccessModal("Purchase completed", `${text}\nTransaction ID: ${transactionToken.id}`);
    } else {
        if (result.status === 400) {
            logToDiscord({
                transactionToken: transactionToken.id,
                userIdInsecure: Twitch.ext.viewer.id!,
                important: false,
                fields: [{ header: "Redeem denied", content: text }],
            }).then();
            showErrorModal(
                "Redeem not available",
                `${text}
                You have been credited the redeem cost, so you may try again later.
                Transaction ID: ${transactionToken.id}`
            );
        } else if (result.status === 500) {
            const errorText = `${result.status} ${result.statusText} - ${text}`;
            logToDiscord({
                transactionToken: transactionToken.id,
                userIdInsecure: Twitch.ext.viewer.id!,
                important: true,
                fields: [{ header: "Redeem failed", content: errorText }],
            }).then();
            showErrorModal(
                "An error occurred.",
                `${errorText}
                Please contact a moderator (preferably AlexejheroDev) about the error!
                You have been credited the redeem cost, so you may try again later.
                Transaction ID: ${transactionToken.id}
                `
            );
        }
    }
}

export async function transactionCancelled() {
    if (transactionToken) {
        logToDiscord({
            transactionToken: transactionToken.id,
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
            body: JSON.stringify({jwt: transactionTokenJwt}),
        });
    }

    hideProcessingModal();
    showErrorModal("Transaction cancelled.", `Transaction ID: ${transactionToken?.id ?? "none"}`);
}

export async function updateClientsideBalance(credit: number) {
    myCredit = credit;
    // TODO: update UI (when there is UI)
}

export async function confirmCreditTransaction(price: number) {
    // temporary obviously
    return true;
    // no modal APIs in this iframe
    //return confirm(`Use ${price} bits from your credit?`);
}
