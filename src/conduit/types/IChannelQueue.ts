export interface IChannelQueue<T> {
    /** The name of the message queue. */
    readonly name: string;

    /**
     * Send a message through the underlying channel.
     * @param message The message to be sent.
     * @param transfer An array of transferable objects to be sent with the message.
     */
    send(message: T, transfer?: Transferable[]): void;

    /**
     * Receives a queued message, or waits until one arrives.
     * @returns A promise resolving to the received message.
     */
    receive(): Promise<T>;

    /**
     * Tries to receive a queued message.
     * Does not wait for a message if the queue is empty.
     * @returns The received message, or undefined if the queue is empty.
     */
    tryReceive(): T | undefined;

    /**
     * Closes the message queue.
     */
    close(): void;
}
