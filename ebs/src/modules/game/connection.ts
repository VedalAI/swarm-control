import { Message, MessageType, TwitchUser } from "./messages";
import { GameMessage, ResultMessage } from "./messages.game";
import * as ServerWS from "ws";
import { v4 as uuid } from "uuid";
import { CommandInvocationSource, RedeemMessage, ServerMessage } from "./messages.server";
import { Redeem, Order } from "common/types";
import { setIngame } from "../config";

const VERSION = "0.1.0";

type RedeemHandler = (redeem: Redeem, order: Order, user: TwitchUser) => Promise<ResultMessage | null>;
type ResultHandler = (result: ResultMessage) => any;

export class GameConnection {
    private handshake: boolean = false;
    private socket: ServerWS | null = null;
    private unsentQueue: ServerMessage[] = [];
    private outstandingRedeems: Map<string, RedeemMessage> = new Map();
    private resultHandlers: Map<string, ResultHandler> = new Map();
    static resultWaitTimeout: number = 10000;
    private resendIntervalHandle?: number;
    private resendInterval = 500;
    private redeemHandlers: RedeemHandler[] = [GameConnection.prototype.sendRedeemToGame.bind(this)];

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
        console.log("Connected to game");
        this.handshake = false;
        this.resendIntervalHandle = +setInterval(() => this.tryResendFromQueue(), this.resendInterval);
        ws.on("message", async (message) => {
            const msgText = message.toString();
            let msg: GameMessage;
            try {
                msg = JSON.parse(msgText);
            } catch {
                console.error("Could not parse message" + msgText);
                return;
            }
            if (msg.messageType !== MessageType.Ping) console.log(`Got message ${JSON.stringify(msg)}`);
            this.processMessage(msg);
        });
        ws.on("close", (code, reason) => {
            const reasonStr = reason ? `reason '${reason}'` : "no reason";
            console.log(`Game socket closed with code ${code} and ${reasonStr}`);
            setIngame(false).then();
            if (this.resendIntervalHandle) {
                clearInterval(this.resendIntervalHandle);
            }
        });
        ws.on("error", (error) => {
            console.log(`Game socket error\n${error}`);
        });
    }
    public processMessage(msg: GameMessage) {
        switch (msg.messageType) {
            case MessageType.Hello:
                this.handshake = true;
                const reply = {
                    ...this.makeMessage(MessageType.HelloBack),
                    allowed: msg.version == VERSION,
                };
                this.sendMessage(reply)
                    .then()
                    .catch((e) => e);
                break;
            case MessageType.Ping:
                this.sendMessage(this.makeMessage(MessageType.Pong))
                    .then()
                    .catch((e) => e);
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
                setIngame(msg.ingame).then();
                break;
            default:
                this.logMessage(msg, `Unknown message type ${msg.messageType}`);
                break;
        }
    }

    public sendMessage(msg: ServerMessage): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.isConnected()) {
                const error = `Tried to send message without a connected socket`;
                this.msgSendError(msg, error);
                reject(error);
                return;
            }
            // allow pong for stress test
            if (!this.handshake && msg.messageType !== MessageType.Pong) {
                const error = `Tried to send message before handshake was complete`;
                this.msgSendError(msg, error);
                reject(error);
                return;
            }
            this.socket!.send(JSON.stringify(msg), { binary: false, fin: true }, (err) => {
                if (err) {
                    this.msgSendError(msg, `${err.name}: ${err.message}`);
                    reject(err);
                    return;
                }
                if (msg.messageType !== MessageType.Pong) console.debug(`Sent message ${JSON.stringify(msg)}`);
                resolve();
            });
        });
    }
    public makeMessage(type: MessageType, guid?: string): Message {
        return {
            messageType: type,
            guid: guid ?? uuid(),
            timestamp: Date.now(),
        };
    }
    public redeem(redeem: Redeem, order: Order, user: TwitchUser): Promise<ResultMessage> {
        return Promise.race([
            new Promise<any>((_, reject) =>
                setTimeout(
                    () => reject(`Timed out waiting for result. The redeem may still go through later, contact AlexejheroDev if it doesn't.`),
                    GameConnection.resultWaitTimeout
                )
            ),
            new Promise<ResultMessage>((resolve, reject) => {
                this.runRedeemHandlers(redeem, order, user)
                    .then(handlersResult => {
                        if (handlersResult) {
                            resolve(handlersResult);
                        } else {
                            reject("Unhandled redeem");
                        }
                    })
                    .catch(e => reject(e));
            }),
        ]);
    }

    private sendRedeemToGame(redeem: Redeem, order: Order, user: TwitchUser): Promise<ResultMessage> {
        return new Promise((resolve, reject) => {
            const msg: RedeemMessage = {
                ...this.makeMessage(MessageType.Redeem),
                guid: order.id,
                source: CommandInvocationSource.Swarm,
                command: redeem.id,
                title: redeem.title,
                announce: redeem.announce ?? true,
                args: order.cart.args,
                user,
            } as RedeemMessage;
            if (this.outstandingRedeems.has(msg.guid)) {
                reject(`Redeeming ${msg.guid} more than once`);
                return;
            }
            this.outstandingRedeems.set(msg.guid, msg);
            this.resultHandlers.set(msg.guid, resolve);
    
            this.sendMessage(msg)
                .then()
                .catch((e) => e); // will get queued to re-send later
        });
    }

    private logMessage(msg: Message, message: string) {
        console.log(`[${msg.guid}] ${message}`);
    }

    private msgSendError(msg: ServerMessage, error: any) {
        this.unsentQueue.push(msg);
        console.error(`Error sending message\n\tMessage: ${JSON.stringify(msg)}\n\tError: ${error}`);
        console.log(`Position ${this.unsentQueue.length} in queue`);
    }

    private tryResendFromQueue() {
        const msg = this.unsentQueue.shift();
        if (!msg) {
            //console.log("Nothing to re-send");
            return;
        }

        console.log(`Re-sending message ${JSON.stringify(msg)}`);
        this.sendMessage(msg)
            .then()
            .catch((e) => e);
    }
    public stressTestSetHandshake(handshake: boolean) {
        this.handshake = handshake;
    }

    public getUnsent() {
        return Array.from(this.unsentQueue);
    }
    public getOutstanding() {
        return Array.from(this.outstandingRedeems.values());
    }

    public onResult(guid: string, callback: ResultHandler) {
        const existing = this.resultHandlers.get(guid);
        if (existing) {
            this.resultHandlers.set(guid, (result: ResultMessage) => {
                existing(result);
                callback(result);
            });
        } else {
            this.resultHandlers.set(guid, callback);
        }
    }

    public addRedeemHandler(handler: RedeemHandler) {
        this.redeemHandlers.push(handler);
    }

    private async runRedeemHandlers(redeem: Redeem, order: Order, user: TwitchUser) {
        for (let i = this.redeemHandlers.length - 1; i >= 0; i--) {
            const handler = this.redeemHandlers[i];
            const res = await handler(redeem, order, user);
            if (!res) continue;
    
            return res;
        }
        return null;
    }
}
