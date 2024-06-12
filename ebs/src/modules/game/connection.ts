import { Message, MessageType, TwitchUser } from "./messages";
import { ResultMessage, GameMessage } from "./messages.game";
import * as ServerWS from "ws";
import { v4 as uuid } from "uuid";
import { CommandInvocationSource, RedeemMessage, ServerMessage } from "./messages.server";
import { Cart, Redeem } from "common/types";
import { setIngame } from "../config";

const VERSION = "0.1.0";

type ResultHandler = (result: ResultMessage) => any;

export class GameConnection {
    private handshake: boolean = false;
    private socket: ServerWS | null = null;
    private unsentQueue: ServerMessage[] = [];
    private outstandingRedeems: Map<string, RedeemMessage> = new Map();
    private resultHandlers: Map<string, ResultHandler> = new Map();
    static resultWaitTimeout: number = 10000;

    public isConnected() {
        return this.socket?.readyState == ServerWS.OPEN;
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
            if (msg.messageType !== MessageType.Ping)
                console.log(`Got message ${JSON.stringify(msg)}`);
            this.processMessage(msg);
        });
        ws.on("close", (code, reason) => {
            console.log(`Connection closed with code ${code} and reason ${reason}`);
            setIngame(false);
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
                const resolve = this.resultHandlers.get(msg.guid);
                if (!resolve) {
                    // nobody cares about this redeem :(
                    console.warn(`[${msg.guid}] No result handler for ${msg.guid}`);
                } else {
                    resolve(msg);
                }
                this.outstandingRedeems.delete(msg.guid);
                this.resultHandlers.delete(msg.guid);
                break;
            case MessageType.IngameStateChanged:
                setIngame(msg.ingame);
                break;
            default:
                this.logMessage(msg, `Unknown message type ${msg.messageType}`);
                break;
        }
    }

    public sendMessage(msg: ServerMessage) {
        if (!this.socket) {
            this.msgSendError(msg, `Tried to send message without a connected socket`);
            return;
        }
        if (!this.handshake) {
            this.msgSendError(msg, `Tried to send message before handshake was complete`);
            return;
        }
        this.socket.send(JSON.stringify(msg), { binary: false, fin: true }, (err) => {
            if (err)
                console.error(err);
        });
        if (msg.messageType !== MessageType.Pong)
            console.debug(`Sent message ${JSON.stringify(msg)}`);
    }
    public makeMessage(type: MessageType, guid?: string): Message {
        return {
            messageType: type,
            guid: guid ?? uuid(),
            timestamp: Date.now()
        }
    }
    public redeem(redeem: Redeem, cart: Cart, user: TwitchUser, transactionId: string) : Promise<ResultMessage> {
        return Promise.race([
            new Promise<any>((_, reject) => setTimeout(() => reject(`Timed out waiting for result`), GameConnection.resultWaitTimeout)),
            new Promise<ResultMessage>((resolve, reject) => {
                if (!transactionId) {
                    reject(`Tried to redeem without transaction ID`);
                    return;
                }
    
                const msg: RedeemMessage = {
                    ...this.makeMessage(MessageType.Redeem),
                    guid: transactionId,
                    source: CommandInvocationSource.Swarm,
                    command: redeem.id,
                    title: redeem.title,
                    announce: redeem.announce,
                    args: cart.args,
                    user
                } as RedeemMessage;
                if (this.outstandingRedeems.has(msg.guid)) {
                    reject(`Redeeming ${msg.guid} more than once`);
                    return;
                }
                this.outstandingRedeems.set(msg.guid, msg);
    
                if (!this.isConnected()) {
                    reject(`Redeemed without active connection`);
                    return;
                }
                this.resultHandlers.set(msg.guid, resolve);
    
                this.sendMessage(msg);
            })
        ]);
    }

    private logMessage(msg: Message, message: string) {
        console.log(`[${msg.guid}] ${message}`);
    }

    private msgSendError(msg: ServerMessage, error: any) {
        this.unsentQueue.push(msg);
        console.error(error + `\n${JSON.stringify(msg)}`);
    }
}
