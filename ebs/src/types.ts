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

export type HttpResult = {
    status: number;
    message: string;
    logHeaderOverride?: string;
    logContents?: any;
};