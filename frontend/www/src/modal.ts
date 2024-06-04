import {Cart} from "./types";

const $modal = document.getElementById("modal-confirm")!;
const $modalTitle = document.getElementById("modal-title")!;
const $modalDescription = document.getElementById("modal-description")!;
const $modalImage = document.getElementById("modal-image")! as HTMLImageElement;
const $modalPrice = document.getElementById("modal-bits")!;
const $modalYes = document.getElementById("modal-yes")!;
const $modalNo = document.getElementById("modal-no")!;

export let cart: Cart | undefined;

document.addEventListener("DOMContentLoaded", () => {
    $modalYes.onclick = confirmPurchase;
    $modalNo.onclick = closeModal;
});

export function openModal(id: string, title: string, description: string, image: string, price: number, sku: string) {
    $modal.style.display = "flex";
    $modalTitle.textContent = title;
    $modalDescription.textContent = description;
    $modalPrice.textContent = price.toString();
    $modalImage.src = image;
    cart = {sku, id, args: {}};
}

function closeModal() {
    $modal.style.display = "none";
    cart = undefined;
}

function confirmPurchase() {
    // TODO: Update cart args
    Twitch.ext.bits.useBits(cart!.sku)
    $modal.style.display = "none";
}
