import { Transaction } from "common/types";
import { hideProcessingModal, openModal, showErrorModal, showSuccessModal, transactionToken, transactionTokenJwt } from "./modal";
import { logToDiscord } from "../util/logger";
import { ebsFetch } from "../util/ebs";
import { twitchUseBits } from "../util/twitch";

type TransactionResponse = Twitch.ext.BitsTransaction | "useCredit" | "cancelled";

let myCredit = 0;

export async function promptTransaction(sku: string): Promise<TransactionResponse> {
    // highly advanced technology (sku names are all "bitsXXX")
    const bitsPrice = parseInt(sku.substring(4));
    console.log(`Purchasing ${sku} for ${bitsPrice} bits (have ${myCredit})`);
    if (myCredit > bitsPrice) {
        return (await confirmCreditTransaction(bitsPrice)) ? "useCredit" : "cancelled";
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
            ...(isCredit ? { type: "credit" } : { type: "bits", receipt: transaction.transactionReceipt }),
        } satisfies Transaction),
    });

    setTimeout(() => hideProcessingModal(), 250);

    const text = await result.text();
    if (result.ok) {
        showSuccessModal("Purchase completed", `${text}\nTransaction ID: ${transactionToken}`);
    } else {
        if (result.status === 400) {
            logToDiscord({
                transactionToken: transactionToken.id,
                userIdInsecure: Twitch.ext.viewer.id!,
                important: true,
                fields: [{ header: "Redeem denied", content: text }],
            }).then();
            showErrorModal(
                "Redeem not available",
                `${text}
                You have been credited the redeem cost, so you may try again later.
                Transaction ID: ${transactionToken}`
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
                Transaction ID: ${transactionToken}
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
            body: JSON.stringify({ token: transactionToken }),
        });
    }

    hideProcessingModal();
    showErrorModal("Transaction cancelled.", `Transaction ID: ${transactionToken}`);
}

export async function updateClientsideBalance(credit: number) {
    myCredit = credit;
    // TODO: update UI (when there is UI)
}

export async function confirmCreditTransaction(price: number) {
    // temporary obviously
    return confirm(`Use ${price} bits from your credit?`);
}
