export const enum LiteralTypes {
    String,
    Integer,
    Float,
    Boolean,
    Vector,
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
    message?: string;
};

export type Cart = {
    version: number;
    clientSession: string; // any string to disambiguate between multiple tabs
    id: string;
    sku: string;
    args: { [name: string]: any };
};

export type IdentifiableCart = Cart & { userId: string };

export type Transaction = {
    token: string; // JWT with TransactionToken (given by EBS on prepurchase)
    clientSession: string; // same session as in Cart
    receipt: string; // JWT with BitsTransactionPayload (coming from Twitch)
};
export type DecodedTransaction = {
    token: TransactionTokenPayload;
    receipt: BitsTransactionPayload;
};

export type TransactionToken = {
    id: string;
    time: number; // Unix millis
    user: {
        id: string; // user channel id
    };
    product: {
        sku: string;
        cost: number;
    };
};
export type TransactionTokenPayload = {
    exp: number;
    data: TransactionToken;
};

export type BitsTransactionPayload = {
    topic: string;
    exp: number;
    data: {
        transactionId: string;
        time: string;
        userId: string;
        product: {
            domainId: string;
            sku: string;
            displayName: string;
            cost: {
                amount: number;
                type: "bits";
            };
        };
    };
};

export type PubSubMessage = {
    type: "config_refreshed" | "banned";
    data: string;
};

export type BannedData = {
    id: string;
    banned: boolean;
};

export type LogMessage = {
    transactionToken: string | null;
    userIdInsecure: string | null;
    important: boolean;
    fields: { header: string; content: any }[];
};

export type User = {
    id: string;
    login?: string;
    displayName?: string;
    banned: boolean;
};

export type OrderState =
    | "rejected"
    | "prepurchase"
    | "cancelled"
    | "paid" // waiting for game
    | "failed" // game failed/timed out
    | "succeeded";

export type Order = {
    id: string;
    userId: string;
    state: OrderState;
    cart: Cart;
    receipt?: string;
    result?: string;
    createdAt: number;
    updatedAt: number;
};

export type Callback<T> = (data: T) => void;
