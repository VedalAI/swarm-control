import { app } from "../..";
import { GameConnection } from "./connection";

export let connection: GameConnection = new GameConnection();

app.ws("/private/socket", (ws) => {
    connection.setSocket(ws);
});

require("./endpoints");
