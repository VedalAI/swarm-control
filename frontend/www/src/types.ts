export type Redeem = {
    id: string;
    title: string;
    description: string;
    image: string;
    price: number;
    sku: string;
};

export type Cart = {
    id: string;
    sku: string;
    args: {[key: string]: string};
}
