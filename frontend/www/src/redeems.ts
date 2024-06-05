import {Redeem} from "./types";
import {openModal} from "./modal";
import {ebsFetch} from "./ebs";

const $redeemContainer = document.getElementById("buttons")!;

document.addEventListener("DOMContentLoaded", () => {
    populateButtons().then();
});

async function getRedeems() {
    const response = await ebsFetch("/public/redeems");
    const data = await response.json();
    return data as Redeem[];
}

async function populateButtons() {
    const redeems = await getRedeems();
    for (const redeem of redeems) {
        const elem = document.createElement("div");
        elem.className = "elem";
        elem.onclick = () => openModal(redeem.id, redeem.title, redeem.description, redeem.image, redeem.price, redeem.sku);

        const img = document.createElement("img");
        img.src = redeem.image;
        elem.appendChild(img);

        const name = document.createElement("p");
        name.textContent = redeem.title;
        elem.appendChild(name);

        const price = document.createElement("p");
        price.textContent = redeem.price.toString();
        elem.appendChild(price);

        $redeemContainer.appendChild(elem);
    }
}
