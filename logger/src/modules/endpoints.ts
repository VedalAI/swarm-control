import { app } from "..";
import { logToDiscord } from "../util/discord";
import { LogMessage } from "common/types";
import { canLog, getUserIdFromTransactionToken, isUserBanned, logToDatabase } from "../util/db";

app.post("/log", async (req, res) => {
    try {
        const logMessage = req.body as LogMessage & { backendToken?: string };
        const isBackendRequest = process.env.PRIVATE_LOGGER_TOKEN == logMessage.backendToken;

        if (!isBackendRequest) {
            const validTransactionToken = await canLog(logMessage.transactionToken);
            if (!validTransactionToken) {
                res.status(403).send("Invalid transaction token.");
                return;
            }

            // Even if the transaction token is valid, this might be a malicious request using a previously created token.
            // In the eventuality that this happens, we also check for extension bans here.

            const userId = await getUserIdFromTransactionToken(logMessage.transactionToken!);

            if (userId && (await isUserBanned(userId))) {
                res.status(403).send("User is banned.");
                return;
            }
        }

        await logToDatabase(logMessage, isBackendRequest);

        if (logMessage.important) {
            logToDiscord(logMessage, isBackendRequest);
        }

        res.sendStatus(200);
    } catch (e: any) {
        console.error("Failed to log");
        console.error(e);
        res.status(500).send("Failed to log");
    }
});
