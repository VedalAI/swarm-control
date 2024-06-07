import { app } from "../index";
import { LogBuilder } from "../discord";
import { LogMessage } from "common/types";

app.post("/log", (req, res) => {
    try {
        const logMessage = req.body as LogMessage;
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
