function ermfish() {
    openModal("confirm");
}

function openModal(modalID) {
    var modal = document.getElementById(modalID);
    modal.style.display = "flex";
}

function closeModal(modalID) {
    var modal = document.getElementById(modalID);
    modal.style.display = "none";
}

function no() {
    closeModal("confirm");
}

function yes() {
    closeModal("confirm");
}

function authenticate() {
    document.getElementById("onboarding").style.display = "none";
}