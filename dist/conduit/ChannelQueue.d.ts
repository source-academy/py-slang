import { IChannelQueue, IChannel } from "./types";
export declare class ChannelQueue<T> implements IChannelQueue<T> {
    readonly name: string;
    private __channel;
    private __messageQueue;
    receive(): Promise<T>;
    tryReceive(): T | undefined;
    send(message: T, transfer?: Transferable[]): void;
    close(): void;
    constructor(channel: IChannel<T>);
}
