export type Redeem = {
  id: string;
  title: string;
  description: string;
  image: string;
  price: number;
  sku: string;
  toggle?: string;
  textbox?: string;
  dropdown: string[];
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
    dropdown?: string;
  }
}

export type Transaction = {
  receipt: string,
  version: number,
} & Cart;
