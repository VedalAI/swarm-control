export type AuthorizationPayload = {
    exp: number;
    opaque_user_id: string;
    user_id?: string;
    channel_id: string;
    role: "broadcaster" | "moderator" | "viewer" | "external";
    is_unlinked: boolean;
    pubsub_perms: {
        listen: string[];
        send: string[];
    };
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
