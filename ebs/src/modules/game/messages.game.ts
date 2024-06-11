import { Message as MessageBase, MessageType } from "./messages";

export type GameMessage
= HelloMessage
    | PingMessage
    | LogMessage
    | ResultMessage
    | IngameStateChangedMessage;
    // | CommandAvailabilityChangedMessage;

type GameMessageBase = MessageBase; // no extra properties
export type HelloMessage = GameMessageBase & {
    messageType: MessageType.Hello,
    version: string,
}

export type PingMessage = GameMessageBase & {
    messageType: MessageType.Ping
}
export type LogMessage = GameMessageBase & {
    messageType: MessageType.Log,
    important: boolean,
    message: string,
}

export type ResultMessage = GameMessageBase & {
    messageType: MessageType.Result,
    success: boolean,
    message?: string,
}

export type IngameStateChangedMessage = GameMessageBase & {
    messageType: MessageType.IngameStateChanged,
    // if false, commands that need Player.main will be disabled
    ingame: boolean,
    // being on land or inside base/seatruck should disable spawns
    canSpawn: boolean,
}

// export type CommandAvailabilityChangedMessage = GameMessageBase & {
//     messageType: MessageType.CommandAvailabilityChanged,
//     becameAvailable: string[],
//     becameUnavailable: string[],
// }