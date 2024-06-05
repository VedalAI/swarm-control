export type Redeem = {
    id: string;
    title: string;
    description: string;
    image: string;
    price: number;
    sku: string;
};

export type Config = {
    version: number;
    redeems: Redeem[];
}

export type Transaction = {
    receipt: string,
    version: number,
    id: string;
    sku: string;
    args: {[key: string]: string};
}
