import "./style.css";
import "./twitch-auth";
import {getConfig} from "./config";
import {Redeem} from "./types";

const redeemContainer = document.getElementById("buttons")!;
const modal = document.getElementById("modal-confirm")!;
const modalTitle = document.getElementById("modal-title")!;
const modalDescription = document.getElementById("modal-description")!;
const modalImage = document.getElementById("modal-image")! as HTMLImageElement;
const modalPrice = document.getElementById("modal-price")!;
const modalYes = document.getElementById("modal-yes")!;
const modalNo = document.getElementById("modal-no")!;

let cart: string;

modalYes.onclick = confirmPurchase;
modalNo.onclick = closeModal;
populateButtons().then();

async function getRedeems() {
    const config = await getConfig();
    const response = await fetch(new URL("redeems", config.backendUrl).toString());
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

        redeemContainer.appendChild(elem);
    }
}

function openModal(id: string, title: string, description: string, image: string, price: number, sku: string) {
    modal.style.display = "flex";
    modalTitle.textContent = title;
    modalDescription.textContent = description;
    modalPrice.textContent = price.toString();
    modalImage.src = image;
    cart = sku;
}

function closeModal() {
    modal.style.display = "none";
}

function confirmPurchase() {
    alert("Bought SKU " + cart);
    modal.style.display = "none";
}
