import { Message, MessageType } from "./messages";

export type GameMessage = Message; // no extra properties

export type HelloMessage = GameMessage & {
    messageType: MessageType.Hello,
    version: string,
}

export type ResultMessage = GameMessage & {
    messageType: MessageType.Result,
    success: boolean,
    message?: string,
}