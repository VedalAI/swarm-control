import "dotenv/config";
import cors from "cors";
import express from "express";
import bodyParser from "body-parser";
import { initDb } from "./util/db";

const port = 3000;

export const app = express();
app.use(cors({ origin: "*" }));
app.use(bodyParser.json());

app.get("/", (_, res) => {
    res.send("YOU ARE TRESPASSING ON PRIVATE PROPERTY YOU HAVE 5 SECONDS TO GET OUT OR I WILL CALL THE POLICE");
});

async function main() {
    await initDb();

    app.listen(port, () => {
        console.log("Listening on port " + port);

        require("./modules/endpoints");
    });
}

main().catch(console.error);
