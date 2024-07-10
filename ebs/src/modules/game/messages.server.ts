import { MessageType, Message, TwitchUser } from "./messages";

export type ServerMessage = Message & {
    /** User that triggered the message. e.g. for redeems, the user who bought the redeem. */
    user?: TwitchUser;
};
export type HelloBackMessage = ServerMessage & {
    messageType: MessageType.HelloBack;
    allowed: boolean;
};

export type ConsoleInputMessage = ServerMessage & {
    messageType: MessageType.ConsoleInput;
    input: string;
};

export enum CommandInvocationSource {
    Swarm,
    Dev,
}
export type RedeemMessage = ServerMessage & {
    messageType: MessageType.Redeem;
    source: CommandInvocationSource;
    command: string;
    title?: string;
    announce: boolean;
    args: any;
};
