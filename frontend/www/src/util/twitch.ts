
type AuthResponse = Twitch.ext.Authorized | "revoked";
type TransactionResponse = Twitch.ext.BitsTransaction | "cancelled";

const authCallbacks: ((viewer: AuthResponse) => void)[] = [];
const transactionCallbacks: ((transaction: TransactionResponse) => void)[] = [];

export async function twitchAuth(): Promise<AuthResponse> {
    // authorized if id is set
    if (!Twitch.ext.viewer.id) {
        Twitch.ext.actions.requestIdShare();
    }
    return new Promise(resolve => authCallbacks.push(resolve));
}

export async function twitchUseBits(sku: string): Promise<TransactionResponse> {
    Twitch.ext.bits.useBits(sku);
    return new Promise(resolve => transactionCallbacks.push(resolve));
}

Twitch.ext.onAuthorized((auth) => {
    const res: AuthResponse = auth.userId ? auth : "revoked";
    authCallbacks.forEach((callback) => callback(res));
    authCallbacks.splice(0, authCallbacks.length);
})

Twitch.ext.bits.onTransactionComplete((transaction) => {
    transactionCallbacks.forEach((callback) => callback(transaction));
    transactionCallbacks.splice(0, transactionCallbacks.length);
});

Twitch.ext.bits.onTransactionCancelled(() => {
    transactionCallbacks.forEach((callback) => callback("cancelled"));
    transactionCallbacks.splice(0, transactionCallbacks.length);
})