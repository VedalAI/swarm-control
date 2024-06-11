import { Message, MessageType } from "./messages";
import { ResultMessage, HelloMessage, GameMessage } from "./messages.game";
import * as ServerWS from "ws";
import { v4 as uuid } from "uuid";
import { CommandInvocationSource, RedeemMessage, ServerMessage } from "./messages.server";
import { Redeem } from "common/types";

const VERSION = "0.1.0";

type ResultHandler = (result: ResultMessage) => any;

export class GameConnection {
    private handshake: boolean = false;
    private socket: ServerWS | null = null;
    private resultHandlers: ResultHandler[] = [];
    private outstandingRedeems: Map<string, RedeemMessage> = new Map<string, RedeemMessage>();

    public isConnected() {
        return this.socket?.readyState == ServerWS.OPEN;
    }
    public onResult(handler: ResultHandler) {
        this.resultHandlers.push(handler);
    }
    public setSocket(ws: ServerWS | null) {
        if (this.isConnected()) {
            this.socket!.close();
        }
        this.socket = ws;
        if (!ws) {
            return;
        }
        ws.on('connection', () => {
            this.handshake = false;
        })
        ws.on('message', async (message) => {
            const msgText = message.toString();
            let msg: GameMessage;
            try {
                msg = JSON.parse(msgText);
            } catch {
                console.error("Could not parse message" + msgText);
                return;
            }
            console.log(`Got message ${JSON.stringify(msg)}`);
            this.processMessage(msg);
        });
        ws.on("close", (code, reason) => {
            console.log(`Connection closed with code ${code} and reason ${reason}`);
        })
        ws.on("error", (error) => {
            console.log(`Connection error ${error}`);
        })
    }
    public async processMessage(msg: GameMessage) {
        switch (msg.messageType) {
            case MessageType.Hello:
                this.handshake = true;
                const reply = {
                    ...this.makeMessage(MessageType.HelloBack),
                    allowed: msg.version == VERSION,
                }
                this.sendMessage(reply);
                break;
            case MessageType.Ping:
                this.sendMessage(this.makeMessage(MessageType.Pong));
                break;
            case MessageType.Result:
                if (!this.outstandingRedeems.has(msg.guid)) {
                    console.error(`[${msg.guid}] Redeeming untracked ${msg.guid} (either unpaid or more than once)`);
                }
                for (const handler of this.resultHandlers) {
                    handler(msg);
                }
                this.outstandingRedeems.delete(msg.guid);
                break;
            case MessageType.IngameStateChanged:
                this.logMessage(msg, `${MessageType[MessageType.IngameStateChanged]} stub`);
                break;
            // case MessageType.CommandAvailabilityChanged:
            //     await this.updateCommandAvailability(msg);
            //     break;
            default:
                console.error(`[${msg.guid}] Unknown message type ${msg.messageType}`);
                break;
        }
    }
    // private async updateCommandAvailability(msg: CommandAvailabilityChangedMessage) {
    //     const config = await getConfig();
    //     if (!config) {
    //         console.error("Can't change command availability, no config");
    //     }
    //     for (const id of msg.becameAvailable) {
    //         const redeem = config.redeems![id];
    //         redeem.disabled = false;
    //     }
    //     for (const id of msg.becameUnavailable) {
    //         const redeem = config.redeems![id];
    //         redeem.disabled = true;
    //     }
    //     broadcastConfigRefresh(config);
    // }

    public sendMessage(msg: ServerMessage) {
        if (!this.socket) {
            // todo queue unsent messages
            console.error(`Tried to send message without a connected socket: ${JSON.stringify(msg)}`);
            return;
        }
        if (!this.handshake) {
            console.error(`Tried to send message before handshake was complete: ${JSON.stringify(msg)}`);
            return;
        }
        this.socket.send(JSON.stringify(msg), { binary: false, fin: true }, (err) => {
            if (err)
                console.error(err);
        });
        if (msg.messageType !== MessageType.Ping)
            console.log(`Sent message ${JSON.stringify(msg)}`);
    }
    public makeMessage(type: MessageType, guid?: string): Message {
        return {
            messageType: type,
            guid: guid ?? uuid(),
            timestamp: Date.now()
        }
    }
    public redeem(redeem: Redeem, args: {[name: string]: any}, announce: boolean, transactionId: string) {
        if (!transactionId) {
            console.error(`Tried to redeem without transaction ID`);
            return;
        }

        const msg: RedeemMessage = {
            ...this.makeMessage(MessageType.Redeem),
            guid: transactionId,
            source: CommandInvocationSource.Swarm,
            command: redeem.id,
            title: redeem.title,
            announce,
            args
        } as RedeemMessage;
        if (this.outstandingRedeems.has(msg.guid)) {
            console.error(`Redeeming ${msg.guid} more than once`);
        }
        this.outstandingRedeems.set(msg.guid, msg);

        if (!this.isConnected()) {
            console.error(`Redeemed without active connection`);
        }

        this.sendMessage(msg);
    }

    private logMessage(msg: Message, message: string) {
        console.log(`[${msg.guid}] ${message}`);
    }
}