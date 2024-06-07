import { app } from "../index";
import { LogBuilder } from "../util/discord";
import { LogMessage } from "common/types";
import { canLog } from "../util/db";

app.post("/log", async (req, res) => {
    try {
        const logMessage = req.body as LogMessage;

        if (!(await canLog(logMessage.transactionToken))) {
            res.status(403).send("Invalid transaction token");
            return;
        }

        const builder = new LogBuilder();

        for (const field of logMessage.fields) {
            builder.addField(field.header, field.content);
        }

        builder.send(logMessage.important);
    } catch (e: any) {
        console.error("Failed to log");
        console.error(e);
        res.status(500).send("Failed to log");
    }
});
