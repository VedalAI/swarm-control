export enum MessageType {
    // game to server
    Hello,
    Ping,
    Log,
    Result,
    IngameStateChanged,
    //CommandAvailabilityChanged,

    // server to game
    HelloBack,
    Pong,
    ConsoleInput,
    Redeem,
}

export type Guid = string;
export type UnixTimestampUtc = number;

export type Message = {
    messageType: MessageType;
    guid: Guid;
    timestamp: UnixTimestampUtc;
};

export type TwitchUser = {
    /** Numeric user id */
    id: string;
    /** Twitch username (login name) */
    login: string;
    /** User's chosen display name. */
    displayName: string;
};
