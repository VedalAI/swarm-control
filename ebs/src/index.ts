import "dotenv/config";
import cors from "cors";
import express from "express";
import expressWs from "express-ws";
import bodyParser from "body-parser";
import { asyncCatch, privateApiAuth, publicApiAuth } from "./util/middleware";
import { initDb } from "./util/db";
import { sendToLogger } from "./util/logger";

const port = 3000;

export const { app } = expressWs(express());
app.use(cors({ origin: "*" }));
app.use(bodyParser.json());
app.use("/public/*", asyncCatch(publicApiAuth));
app.use("/private/*", privateApiAuth);

app.get("/", (_, res) => {
    res.send("YOU ARE TRESPASSING ON PRIVATE PROPERTY YOU HAVE 5 SECONDS TO GET OUT OR I WILL CALL THE POLICE");
});

async function main() {
    await initDb();

    app.listen(port, () => {
        console.log("Listening on port " + port);

        // add endpoints
        require("./modules/config");
        require("./modules/game");
        require("./modules/orders");
        require("./modules/twitch");
        require("./modules/user");

        const { setIngame } = require("./modules/config");

        process.stdin.resume();

        ["exit", "SIGINT", "SIGTERM"].forEach((signal) =>
            process.on(signal, () => {
                try {
                    console.log("Exiting...");

                    setIngame(false);

                    // Give the pubsub some time to broadcast the new config.
                    setTimeout(() => {
                        process.exit(0);
                    }, 5_000);
                } catch (err) {
                    console.error("Error while exiting:", err);
                    process.exit(1);
                }
            })
        );

        ["unhandledRejection", "uncaughtException"].forEach((event) =>
            process.on(event, (err) => {
                try {
                    console.error("Unhandled error:", err);

                    sendToLogger({
                        transactionToken: null,
                        userIdInsecure: null,
                        important: true,
                        fields: [
                            {
                                header: "Unhandled error/exception:",
                                content: err?.stack ?? err,
                            },
                        ],
                    }).then();

                    // Exit and hope that Docker will auto-restart the container.
                    process.kill(process.pid, "SIGTERM");
                } catch (err) {
                    console.error("Error while error handling, mhm:", err);
                    process.exit(1);
                }
            })
        );
    });
}

main().catch(console.error);
