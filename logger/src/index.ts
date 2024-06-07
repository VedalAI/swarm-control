import { config as dotenv } from "dotenv";
import cors from "cors";
import express from "express";
import bodyParser from "body-parser";

dotenv();

export const app = express();
app.use(cors({ origin: "*" }));
app.use(bodyParser.json());

app.get("/", (_, res) => {
    res.send("YOU ARE TRESPASSING ON PRIVATE PROPERTY YOU HAVE 5 SECONDS TO GET OUT OR I WILL CALL THE POLICE");
});

app.listen(parseInt(process.env.PORT!), () => {
    console.log("Listening on port " + process.env.PORT);

    require("./modules/config");
    require("./modules/transactions");
});
