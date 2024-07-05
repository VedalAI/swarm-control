import { Cart } from "common/types";

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
    cart?: Cart;
    receipt?: string;
    result?: string;
    createdAt: number;
    updatedAt: number;
};
