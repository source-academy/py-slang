import { IChannel, Subscriber } from "./types";
export declare class Channel<T> implements IChannel<T> {
    readonly name: string;
    /** The underlying MessagePort of this Channel. */
    private __port;
    /** The callbacks subscribed to this Channel. */
    private readonly __subscribers;
    /** Is the Channel allowed to be used? */
    private __isAlive;
    private __waitingMessages?;
    send(message: T, transfer?: Transferable[]): void;
    subscribe(subscriber: Subscriber<T>): void;
    unsubscribe(subscriber: Subscriber<T>): void;
    close(): void;
    /**
     * Check if this Channel is allowed to be used.
     * @throws Throws an error if the Channel has been closed.
     */
    private __verifyAlive;
    /**
     * Dispatch some data to subscribers.
     * @param data The data to be dispatched to subscribers.
     */
    private __dispatch;
    /**
     * Listens to the port's message event, and starts the port.
     * Messages will be buffered until the first subscriber listens to the Channel.
     * @param port The MessagePort to listen to.
     */
    listenToPort(port: MessagePort): void;
    /**
     * Replaces the underlying MessagePort of this Channel and closes it, and starts the new port.
     * @param port The new port to use.
     */
    replacePort(port: MessagePort): void;
    constructor(name: string, port: MessagePort);
}
