const confirmModal = { // this works kind of like a class -> Object with properties and methods
    element: document.getElementById("modal-confirm"),
    modalYes: document.getElementById("modal-yes"),
    modalNo: document.getElementById("modal-no"),
    modalBits: document.getElementById("modal-bits"),
    modalTitle: document.getElementById("modal-title"),
    modalImage: document.getElementById("modal-image"),

    open(image, title, bits) {
        this.element.style.display = "flex";
        this.modalTitle.innerText = title;
        this.modalBits.innerText = bits;
        this.modalImage.src = `img/${image}`;


        return new Promise((resolve) => {
            this.modalYes.onclick = () => {
                resolve(true);
                this.close();
            }
            this.modalNo.onclick = () => {
                resolve(false);
                this.close();
            }
        });
    },

    close() {
        this.element.style.display = "none";
    }
}

async function loadButtons() {
    const buttonsJson = await (await fetch("buttons.json")).json();
    console.log(buttonsJson);
    for (let buttonData of buttonsJson) {
        generateButton(buttonData);
    }
}

function generateButton(buttonData) {
    const elem = document.createElement("div");
    elem.className = "elem";
    elem.onclick = async () => {
        const confirmed = await confirmModal.open(buttonData.image, buttonData.name, buttonData.bits);
        if (confirmed) {
            // TODO - Do something -> Send request to backend
            console.log(buttonData);
        }
    }

    const img = document.createElement("img");
    img.src = `img/${buttonData.image}`;
    elem.appendChild(img);

    const p = document.createElement("p");
    p.innerText = buttonData.name;
    elem.appendChild(p);

    document.getElementById("buttons").appendChild(elem);
}

function authenticate() {
    document.getElementById("onboarding").style.display = "none";
    loadButtons();
}