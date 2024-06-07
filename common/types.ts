type EnumTypeName = string;
type ParamType = "string" | "integer" | "float" | "boolean" | EnumTypeName;

export type Enum = {
  name: EnumTypeName;
  values: string[];
}

export type Parameter = {
  name: string;
  title?: string;
  description?: string;
  type: ParamType;
  required?: boolean;
  defaultValue?: any;
}

export type Redeem = {
    id: string;
    title: string;
    description: string;
    image: string;
    price: number;
    sku: string;
    args: Parameter[];
    hidden?: boolean;
};

export type Config = {
    version: number;
    enums: Enum[];
    redeems: Redeem[];
    banned: string[];
    message?: string;
}

export type Cart = {
    id: string;
    sku: string;
    args: {[name: string]: any};
}

export type Transaction = {
    receipt: string,
    version: number,
} & Cart;

export type PubSubMessage = {
    type: string,
    data: string,
}
