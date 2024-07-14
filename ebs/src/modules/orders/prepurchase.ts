import { Cart, Config, Order, User } from "common/types";
import { getConfig } from "../config";
import { HttpResult } from "../../types";
import { getUserSession } from "../user";

const defaultResult: HttpResult = { status: 409, message: "Validation failed" };

export async function validatePrepurchase(order: Order, user: User): Promise<HttpResult | null> {
    const cart = order.cart;
    if (!cart?.clientSession) {
        return { ...defaultResult, logHeaderOverride: "Missing client session", logContents: { cart } };
    }

    const existingSession = await getUserSession(user);
    if (existingSession && order.cart.clientSession != existingSession) {
        return {
            ...defaultResult,
            message: "Extension already open in another tab, please try again there or reload this page to make this the main session",
            logHeaderOverride: "Non-main session",
            logContents: { existingSession: existingSession, order: order.id },
        };
    }

    const config = await getConfig();
    if (cart.version != config.version) {
        return { ...defaultResult, message: "Invalid config version", logContents: { received: cart.version, expected: config.version } };
    }

    const redeem = config.redeems?.[cart.id];
    if (!redeem || redeem.sku != cart.sku || redeem.disabled || redeem.hidden) {
        return { ...defaultResult, message: "Invalid redeem", logContents: { received: cart, inConfig: redeem } };
    }

    const valError = validateArgs(config, cart);
    if (valError) {
        return {
            ...defaultResult,
            message: "Invalid arguments",
            logHeaderOverride: "Arg validation failed",
            logContents: {
                error: valError,
                redeem: cart.id,
                expected: redeem.args,
                provided: cart.args,
            },
        };
    }

    return null;
}

function validateArgs(config: Config, cart: Cart): string | undefined {
    const redeem = config.redeems![cart.id];

    for (const arg of redeem.args) {
        const value = cart.args[arg.name];
        if (!value) {
            if (!arg.required) continue;

            // LiteralTypes.Boolean
            if (arg.type === 3) {
                // HTML form conventions - false is not transmitted, true is "on" (to save 2 bytes i'm guessing)
                continue;
            }

            return `Missing required argument ${arg.name}`;
        }
        let parsed: number;
        switch (arg.type) {
            // esbuild dies if you use enums
            // so we have to use their pure values instead
            case 0: // LiteralTypes.String
                if (typeof value !== "string") {
                    return `Argument ${arg.name} not a string`;
                }
                const minLength = arg.minLength ?? 0;
                const maxLength = arg.maxLength ?? 255;
                if (value.length < minLength || value.length > maxLength) {
                    return `Text length out of range for ${arg.name}`;
                }
                break;
            case 1: // LiteralTypes.Integer
            case 2: // LiteralTypes.Float
                parsed = parseInt(value);
                if (Number.isNaN(parsed)) {
                    return `Argument ${arg.name} is not a number`;
                }
                // LiteralTypes.Integer
                if (arg.type === 1 && parseFloat(value) != parsed) {
                    return `Argument ${arg.name} is not an integer`;
                }
                if ((arg.min !== undefined && parsed < arg.min) || (arg.max !== undefined && parsed > arg.max)) {
                    return `Number ${arg.name} out of range`;
                }
                break;
            case 3: // LiteralTypes.Boolean
                if (typeof value !== "boolean" && value !== "true" && value !== "false" && value !== "on") {
                    return `Argument ${arg.name} not a boolean`;
                }
                if (value === "on") {
                    cart.args[arg.name] = true;
                }
                break;
            case 4: // LiteralTypes.Vector
                if (!Array.isArray(value) || value.length < 3) {
                    return `Vector3 ${arg.name} not a 3-elem array`;
                }
                // workaround for #49
                const lastThree = value.slice(value.length - 3);
                for (const v of lastThree) {
                    parsed = parseFloat(v);
                    if (Number.isNaN(parsed)) {
                        return `Vector3 ${arg.name} components not all floats`;
                    }
                }
                cart.args[arg.name] = lastThree;
                break;
            default:
                const argEnum = config.enums?.[arg.type];
                if (!argEnum) {
                    return `No such enum ${arg.type}`;
                }
                parsed = parseInt(value);
                if (Number.isNaN(parsed) || parsed != parseFloat(value)) {
                    return `Enum value ${value} (for enum ${arg.type}) not an integer`;
                }
                if (parsed < 0 || parsed >= argEnum.length) {
                    return `Enum value ${value} (for enum ${arg.type}) out of range`;
                }
                if (argEnum[parsed].startsWith("[DISABLED]")) {
                    return `Enum value ${value} (for enum ${arg.type}) is disabled`;
                }
                break;
        }
    }
}
