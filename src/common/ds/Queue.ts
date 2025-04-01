/**
 * A stack-based queue implementation.
 * `push` and `pop` run in amortized constant time.
 */
export class Queue<T> {
    /** The output stack. */
    private __s1: T[] = [];
    /** The input stack. */
    private __s2: T[] = [];

    /**
     * Adds an item to the queue.
     * @param item The item to be added to the queue.
     */
    push(item: T) {
        this.__s2.push(item);
    }

    /**
     * Removes an item from the queue.
     * @returns The item removed from the queue.
     * @throws If the queue is empty.
     */
    pop(): T {
        if (this.__s1.length === 0) {
            if (this.__s2.length === 0) throw new Error("queue is empty");
            let temp = this.__s1;
            this.__s1 = this.__s2.reverse();
            this.__s2 = temp;
        }
        return this.__s1.pop()!; // as the length is nonzero
    }

    /**
     * The length of the queue.
     */
    get length() {
        return this.__s1.length + this.__s2.length;
    }

    /**
     * Makes a copy of the queue.
     * @returns A copy of the queue.
     */
    clone(): Queue<T> {
        const newQueue = new Queue<T>();
        newQueue.__s1 = [...this.__s1];
        newQueue.__s2 = [...this.__s2];
        return newQueue;
    }
}
