import { app } from "../index";
import { LogBuilder } from "../util/discord";
import { LogMessage } from "common/types";
import { canLog, getUserIdFromTransactionToken, isUserBanned } from "../util/db";

app.post("/log", async (req, res) => {
    try {
        const logMessage = req.body as LogMessage & { backendToken?: string };

        if (process.env.PRIVATE_LOGGER_TOKEN! == logMessage.backendToken) {
            // This is a log comin from the backend, we should let it through
        } else {
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

        const builder = new LogBuilder();

        // TODO: add transaction token and user id to the log message

        for (const field of logMessage.fields) {
            builder.addField(field.header, field.content);
        }

        builder.send(logMessage.important);

        res.sendStatus(200);
    } catch (e: any) {
        console.error("Failed to log");
        console.error(e);
        res.status(500).send("Failed to log");
    }
});
