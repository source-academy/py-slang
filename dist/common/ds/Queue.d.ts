/**
 * A stack-based queue implementation.
 * `push` and `pop` run in amortized constant time.
 */
export declare class Queue<T> {
    /** The output stack. */
    private __s1;
    /** The input stack. */
    private __s2;
    /**
     * Adds an item to the queue.
     * @param item The item to be added to the queue.
     */
    push(item: T): void;
    /**
     * Removes an item from the queue.
     * @returns The item removed from the queue.
     * @throws If the queue is empty.
     */
    pop(): T;
    /**
     * The length of the queue.
     */
    get length(): number;
    /**
     * Makes a copy of the queue.
     * @returns A copy of the queue.
     */
    clone(): Queue<T>;
}
