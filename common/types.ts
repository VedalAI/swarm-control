export const enum LiteralTypes {
    String,
    Integer,
    Float,
    Boolean,
    Vector
}

type EnumTypeName = string;
type ParamType = LiteralTypes | EnumTypeName;

export type Parameter = TextParam | NumericParam | BooleanParam | EnumParam | VectorParam;
type ParameterBase = {
    name: string;
    title?: string;
    description?: string;
    type: ParamType;
    required?: boolean;
};

export type TextParam = ParameterBase & {
    type: LiteralTypes.String;
    defaultValue?: string;
    minLength?: number;
    maxLength?: number;
};

export type NumericParam = ParameterBase & {
    type: LiteralTypes.Integer | LiteralTypes.Float;
    defaultValue?: number;
    min?: number;
    max?: number;
};

export type BooleanParam = ParameterBase & {
    type: LiteralTypes.Boolean;
    defaultValue?: boolean;
};

export type EnumParam = ParameterBase & {
    type: EnumTypeName;
    defaultValue?: string;
};

export type VectorParam = ParameterBase & {
    type: LiteralTypes.Vector;
    defaultValue?: [number, number, number];
    min?: number[];
    max?: number[];
};

export type Redeem = {
    id: string;
    title: string;
    description: string;
    args: Parameter[];
    announce?: boolean;
    moderated?: boolean;
    
    image: string;
    price: number;
    sku: string;
    disabled?: boolean;
    hidden?: boolean;
};

export type Config = {
    version: number;
    enums?: { [name: string]: string[] };
    redeems?: { [id: string]: Redeem };
    banned?: string[];
    message?: string;
};

export type Cart = {
    version: number;
    id: string;
    sku: string;
    args: { [name: string]: any };
};

export type IdentifiableCart = Cart & {
    userId: string;
};

export type Transaction = {
    receipt: string;
    token: string;
};

export type PubSubMessage = {
    type: string;
    data: string;
};

export type LogMessage = {
    transactionToken: string | null;
    userIdInsecure: string | null;
    important: boolean;
    fields: { header: string; content: any }[];
};
