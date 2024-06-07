import { config as dotenv } from "dotenv";
import cors from "cors";
import express from "express";
import bodyParser from "body-parser";
import mysql from "mysql2/promise";
import { privateApiAuth, publicApiAuth } from "./util/middleware";
import { setupDb } from "./util/db";

dotenv();

const port = 3000;

export const app = express();
app.use(cors({ origin: "*" }));
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
            console.log("Failed to connect to database. Retrying in 5 seconds...");
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }

    await setupDb();

    app.listen(port, () => {
        console.log("Listening on port " + port);

        require("./modules/config");
        require("./modules/transactions");
    });
}

main().catch(console.error);
