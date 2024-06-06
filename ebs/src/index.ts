import {config as dotenv} from "dotenv";
import cors from "cors";
import express from "express";
import bodyParser from "body-parser";
import {privateApiAuth, publicApiAuth} from "./middleware";

dotenv();

export const app = express();
app.use(cors({origin: "*"}));
app.use(bodyParser.json());
app.use("/public/*", publicApiAuth);
app.use("/private/*", privateApiAuth);
app.listen(3000, () => console.log("Listening on port 3000"));

app.get("/", (_, res) => {
    res.send("YOU ARE TRESPASSING ON PRIVATE PROPERTY YOU HAVE 5 SECONDS TO GET OUT OR I WILL CALL THE POLICE");
})

require("./modules/config");
require("./modules/transactions");
