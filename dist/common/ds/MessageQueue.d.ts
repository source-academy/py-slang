export declare class MessageQueue<T> {
    private readonly __inputQueue;
    private readonly __promiseQueue;
    push(item: T): void;
    pop(): Promise<T>;
    tryPop(): T | undefined;
    constructor();
}
