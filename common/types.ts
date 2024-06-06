export type Redeem = {
    id: string;
    title: string;
    description: string;
    image: string;
    price: number;
    sku: string;
    toggle?: string;
    textbox?: string;
    dropdown1?: string[];
    dropdown2?: string[];
    command: string; // "addsignal {vector3[x]} {vector3[y]} {vector3[z]} {text}"
    disabled?: boolean;
    hidden?: boolean;
};

export type Config = {
    version: number;
    redeems: Redeem[];
}

export type Cart = {
    id: string;
    sku: string;
    args: {
        text?: string;
        toggle?: boolean;
        dropdown1?: string;
        dropdown2?: string;
        // vector3: [number, number, number];
    }
}

export type Transaction = {
    receipt: string,
    version: number,
} & Cart;

export type PubSubMessage = {
    type: string,
    data: string,
}
