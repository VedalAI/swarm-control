import { Message, MessageType } from "./messages";
import { ResultMessage, HelloMessage, GameMessage, CommandAvailabilityChangedMessage } from "./messages.game";
import * as ServerWS from "ws";
import { v4 as uuid } from "uuid";
import { RedeemMessage, ServerMessage } from "./messages.server";
import { getConfig } from "../config";

const VERSION = "0.1.0";

type ResultHandler = (result: ResultMessage) => any;

export class GameConnection {
    private handshake: boolean = false;
    private socket: ServerWS | null = null;
    private resultHandlers: ResultHandler[] = [];
    private outstandingRedeems: Set<string> = new Set<string>();

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
                    allowed: (msg as HelloMessage).version == VERSION,
                }
                this.sendMessage(reply);
                break;
            case MessageType.Ping:
                this.sendMessage(this.makeMessage(MessageType.Pong));
                break;
            case MessageType.Result:
                if (!this.outstandingRedeems.has(msg.guid)) {
                }
                for (const handler of this.resultHandlers) {
                    handler(msg as ResultMessage);
                }
                this.outstandingRedeems.delete(msg.guid);
                break;
            case MessageType.IngameStateChanged:
                this.logMessage(msg, `${MessageType[MessageType.IngameStateChanged]} stub`);
                break;
            case MessageType.CommandAvailabilityChanged:
                await this.updateCommandAvailability(msg);
                break;
            default:
                console.error(`[${msg.guid}] Unknown message type ${msg.messageType}`);
                break;
        }
    }
    private async updateCommandAvailability(msg: CommandAvailabilityChangedMessage) {
        const config = await getConfig();
        if (!config) {
            console.error("Can't change command availability, no config");
        }
        for (const id of msg.becameAvailable) {
            // redeems need to be a map
            //config.redeems[id].disabled = false;
        }
        console.log(`[${msg.guid}] ${MessageType[MessageType.CommandAvailabilityChanged]} stub`);
    }

    public sendMessage(msg: ServerMessage) {
        if (!this.socket) {
            // todo queue unsent messages
            console.error(`Tried to send message ${JSON.stringify(msg)} without a connected socket`);
            return;
        }
        if (!this.handshake) {
            console.error(`Tried to send message ${JSON.stringify(msg)} before handshake was complete`);
            return;
        }
        this.socket.send(JSON.stringify(msg), { binary: false, fin: true }, (err) => {
            if (err)
                console.error(err);
        });
        console.log(`Sent message ${JSON.stringify(msg)}`);
    }
    public makeMessage(type: MessageType, guid?: string): Message {
        return {
            messageType: type,
            guid: guid ?? uuid(),
            timestamp: Date.now()
        }
    }
    public redeem(msg: RedeemMessage) {
        if (this.outstandingRedeems.has(msg.guid)) {
            console.error(`Tried to redeem ${msg.guid} twice`);
        }
        this.outstandingRedeems.add(msg.guid);
        this.sendMessage(msg);
    }

    private logMessage(msg: Message, message: string) {
        console.log(`[${msg.guid}] ${message}`);
    }
}