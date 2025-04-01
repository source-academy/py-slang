import type { Subscriber } from "./Subscriber";

export interface IChannel<T> {
    /** The name of the channel. */
    readonly name: string;

    /**
     * Send a message through this channel.
     * @param message The message to be sent.
     * @param transfer An array of transferable objects to be sent with the message.
     */
    send(message: T, transfer?: Transferable[]): void;

    /**
     * Subscribe to messages on this channel.
     * @param subscriber The function to be called when a message is received.
     */
    subscribe(subscriber: Subscriber<T>): void;

    /**
     * Unsubscribe from messages on this channel.
     * @param subscriber The function that was called when a message is received.
     */
    unsubscribe(subscriber: Subscriber<T>): void;

    /**
     * Closes the channel, and frees any held resources.
     */
    close(): void;
}
