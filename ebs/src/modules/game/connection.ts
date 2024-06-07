import { MessageType } from "./messages";
import { ResultMessage, GameMessage, HelloMessage } from "./messages.game";
import * as ServerWS from "ws";
import { v4 as uuid } from "uuid";
import { RedeemMessage, ServerMessage } from "./messages.server";

const VERSION = "0.1.0";

type ResultHandler = (result: ResultMessage) => any;

export class Connection {
    private handshake: boolean = false;
    private socket: ServerWS | null = null;
    private redeems: Map<string, ResultHandler> = new Map();
    
    public isConnected() {
        return this.socket?.readyState == ServerWS.OPEN;
    }
    public setSocket(ws: ServerWS) {
        if (this.isConnected()) {
            this.socket!.close();
        }
        this.socket = ws;
        ws.on('connection', () => {
            console.log(`Connected`);
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
    public processMessage(msg: GameMessage) {
        switch (msg.messageType) {
            case MessageType.Hello:
                this.handshake = true;
                const reply = {
                    ...this.makeMessage(MessageType.HelloBack),
                    allowed: (msg as HelloMessage).version == VERSION,
                }
                this.sendMessage(reply);
                break;
            case MessageType.Ping:
                this.sendMessage(this.makeMessage(MessageType.Pong));
                break;
            case MessageType.Result:
                const handler = this.getRedeemHandler(msg.guid);
                if (!handler) {
                    console.error(`[${msg.guid}] Result without handler (already handled?)`);
                    break;
                }
                handler(msg as ResultMessage);
                this.redeems.delete(msg.guid);
                break;
            case MessageType.GameLoadedStateChanged:
                console.log(`[${msg.guid}] ${MessageType.GameLoadedStateChanged} stub`);
                break;
            case MessageType.GamePausedStateChanged:
                console.log(`[${msg.guid}] ${MessageType.GamePausedStateChanged} stub`);
                break;
            case MessageType.CommandAvailabilityChanged:
                console.log(`[${msg.guid}] ${MessageType.CommandAvailabilityChanged} stub`);
                break;
            default:
                console.error(`[${msg.guid}] Unknown message type ${msg.messageType}`);
                break;
        }
    }
    public sendMessage(msg: ServerMessage) {
        if (!this.socket) {
            // todo queue unsent messages
            console.error(`Tried to send message ${JSON.stringify(msg)} without a connected socket`);
            return;
        }
        if (this.handshake) {
            this.socket.send(JSON.stringify(msg), {fin: true}, (err) => {
                if (err)
                    console.error(err);
            });
            console.log(`Sent message ${JSON.stringify(msg)}`);
        } else {
            console.error(`Tried to send message ${JSON.stringify(msg)} before handshake was complete`);
        }
    }
    public makeMessage(type: MessageType, guid?: string) : GameMessage {
        return {
            messageType: type,
            guid: guid ?? uuid(),
            timestamp: new Date().getTime(),
        }
    }
    public redeem(msg: RedeemMessage, onresult: ResultHandler) {
        this.redeems.set(msg.guid, onresult);
        this.sendMessage(msg);
    }

    private getRedeemHandler(guid: string) : ResultHandler | undefined {
        return this.redeems.get(guid)
    }
}