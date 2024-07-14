import { Callback } from "common/types";

type AuthResponse = Twitch.ext.Authorized;
type TransactionResponse = Twitch.ext.BitsTransaction | "cancelled";

class Callbacks<T> {
    private persistent: Callback<T>[] = [];
    private transient: Callback<T>[] = [];

    public addPersistent(callback: Callback<T>) {
        this.persistent.push(callback);
    }

    public addTransient(callback: Callback<T>) {
        this.transient.push(callback);
    }

    public call(data: T) {
        this.persistent.forEach((cb) => cb(data));
        this.transient.forEach((cb) => cb(data));
        this.transient.splice(0, this.transient.length);
    }
}

const authCallbacks: Callbacks<AuthResponse> = new Callbacks();
const transactionCallbacks: Callbacks<TransactionResponse> = new Callbacks();

Twitch.ext.onAuthorized((auth) => {
    authCallbacks.call(auth);
});

Twitch.ext.bits.onTransactionComplete((transaction) => {
    transactionCallbacks.call(transaction);
});

Twitch.ext.bits.onTransactionCancelled(() => {
    transactionCallbacks.call("cancelled");
});

export async function twitchAuth(requestIdShare = true): Promise<AuthResponse> {
    // if id is set, we're authorized
    if (!Twitch.ext.viewer.id && requestIdShare) {
        Twitch.ext.actions.requestIdShare();
    }
    return new Promise(Callbacks.prototype.addTransient.bind(authCallbacks));
}

export async function twitchUseBits(sku: string): Promise<TransactionResponse> {
    Twitch.ext.bits.useBits(sku);
    return new Promise(Callbacks.prototype.addTransient.bind(transactionCallbacks));
}

export function onTwitchAuth(callback: Callback<AuthResponse>) {
    authCallbacks.addPersistent(callback);
}

export function onTwitchBits(callback: Callback<TransactionResponse>) {
    transactionCallbacks.addPersistent(callback);
}
