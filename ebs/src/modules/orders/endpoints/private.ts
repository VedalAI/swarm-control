import { app } from "../../..";
import { getOrder } from "../../../util/db";

app.get("/private/order/:guid", (req, res) => {
    return getOrder(req.params["guid"]);
});
