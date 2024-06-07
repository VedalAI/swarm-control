import { config as dotenv } from "dotenv";
import cors from "cors";
import express from "express";
import expressWs from "express-ws";
import bodyParser from "body-parser";
import mysql from "mysql2/promise";
import { privateApiAuth, publicApiAuth } from "./middleware";
import { setupDb } from "./db";

dotenv();

export const { app } = expressWs(express());
app.use(cors({ origin: "*" }))
app.use(bodyParser.json());
app.use("/public/*", publicApiAuth);
app.use("/private/*", privateApiAuth);

app.get("/", (_, res) => {
    res.send("YOU ARE TRESPASSING ON PRIVATE PROPERTY YOU HAVE 5 SECONDS TO GET OUT OR I WILL CALL THE POLICE");
});

export let db: mysql.Connection;

async function main() {
    while (true) {
        try {
            db = await mysql.createConnection({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
            });
            break;
        } catch {
            if (!process.env.DB_HOST) {
                break;
            }
            console.log("Failed to connect to database. Retrying in 5 seconds...");
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }
    
    if (db) {
        await setupDb();
    }

    app.listen(parseInt(process.env.PORT!), () => {
        console.log("Listening on port " + process.env.PORT);

        require("./modules/config");
        require("./modules/transactions");
        require("./modules/game");

    });
}

main().catch(console.error);
