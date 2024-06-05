import {Redeem} from "../types";
import {app} from "../index";

let redeems: Redeem[];

const gistUrl = "https://gist.githubusercontent.com/Alexejhero/804fe0900d015b89a934a9b759ba2330/raw"

async function fetchRedeems() {
    const url = `${gistUrl}?${Date.now()}`;

    const response = await fetch(url);
    const data = await response.json();

    return data as Redeem[];
}

export async function getRedeems() {
    if (!redeems) {
        redeems = await fetchRedeems();
    }

    return redeems;
}

app.get("/private/refresh", async (req, res) => {
    redeems = await fetchRedeems();
    res.sendStatus(200);
});

app.get("/public/redeems", async (req, res) => {
    const redeems = await getRedeems();
    console.log(redeems);
    res.send(JSON.stringify(redeems));
});
