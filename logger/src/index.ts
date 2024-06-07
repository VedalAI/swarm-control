import { config as dotenv } from "dotenv";
import cors from "cors";
import express from "express";
import bodyParser from "body-parser";
import mysql from "mysql2/promise";

dotenv();

const port = 3000;

export const app = express();
app.use(cors({ origin: "*" }));
app.use(bodyParser.json());

app.get("/", (_, res) => {
    res.send("YOU ARE TRESPASSING ON PRIVATE PROPERTY YOU HAVE 5 SECONDS TO GET OUT OR I WILL CALL THE POLICE");
});

export let db: mysql.Connection;

async function main() {
    while (true) {
        try {
            db = await mysql.createConnection({
                host: process.env.MYSQL_HOST,
                user: process.env.MYSQL_USER,
                password: process.env.MYSQL_PASSWORD,
                database: process.env.MYSQL_DATABASE,
            });
            break;
        } catch {
            console.log("Failed to connect to database. Retrying in 5 seconds...");
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }

    app.listen(port, () => {
        console.log("Listening on port " + port);

        require("./modules/endpoints");
    });
}

main().catch(console.error);
