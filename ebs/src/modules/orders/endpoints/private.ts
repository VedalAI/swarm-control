import { app } from "../../..";
import { getOrder } from "../../../util/db";
import { asyncCatch } from "../../../util/middleware";

app.get(
    "/private/order/:guid",
    asyncCatch(async (req, res) => {
        res.json(await getOrder(req.params["guid"]));
    })
);
