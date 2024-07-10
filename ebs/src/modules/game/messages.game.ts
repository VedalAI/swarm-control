import { Message as MessageBase, MessageType } from "./messages";

export type GameMessage =
    | HelloMessage
    | PingMessage
    | LogMessage
    | ResultMessage
    | IngameStateChangedMessage;

type GameMessageBase = MessageBase; // no extra properties
export type HelloMessage = GameMessageBase & {
    messageType: MessageType.Hello;
    version: string;
};

export type PingMessage = GameMessageBase & {
    messageType: MessageType.Ping;
};
export type LogMessage = GameMessageBase & {
    messageType: MessageType.Log;
    important: boolean;
    message: string;
};

export type ResultMessage = GameMessageBase & {
    messageType: MessageType.Result;
    success: boolean;
    message?: string;
};

export type IngameStateChangedMessage = GameMessageBase & {
    messageType: MessageType.IngameStateChanged;
    // disable all redeems if false
    ingame: boolean;
};
