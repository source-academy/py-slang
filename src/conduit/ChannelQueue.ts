import { MessageQueue } from "../common/ds";
import { IChannelQueue, IChannel } from "./types";

export class ChannelQueue<T> implements IChannelQueue<T> {
    readonly name: string;
    private __channel: IChannel<T>;
    private __messageQueue: MessageQueue<T> = new MessageQueue();

    async receive(): Promise<T> {
        return this.__messageQueue.pop();
    }
    tryReceive(): T | undefined {
        return this.__messageQueue.tryPop();
    }
    send(message: T, transfer?: Transferable[]): void {
        this.__channel.send(message, transfer);
    }
    close(): void {
        this.__channel.unsubscribe(this.__messageQueue.push);
    }
    constructor(channel: IChannel<T>) {
        this.name = channel.name;
        this.__channel = channel;
        this.__channel.subscribe(this.__messageQueue.push);
    }
}
