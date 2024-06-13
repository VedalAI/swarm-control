import { config as dotenv } from "dotenv";
import cors from "cors";
import express from "express";
import expressWs from "express-ws";
import bodyParser from "body-parser";
import { privateApiAuth, publicApiAuth } from "./util/middleware";
import { initDb } from "./util/db";

dotenv();

const port = 3000;

export const { app } = expressWs(express());
app.use(cors({ origin: "*" }));
app.use(bodyParser.json());
app.use("/public/*", publicApiAuth);
app.use("/private/*", privateApiAuth);

app.get("/", (_, res) => {
    res.send("YOU ARE TRESPASSING ON PRIVATE PROPERTY YOU HAVE 5 SECONDS TO GET OUT OR I WILL CALL THE POLICE");
});

async function main() {
    await initDb();

    app.listen(port, () => {
        console.log("Listening on port " + port);

        require("./modules/config");
        require("./modules/transactions");
        require("./modules/game");

    });
}

main().catch(console.error);
