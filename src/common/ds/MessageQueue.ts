import { Queue } from "./Queue";

export class MessageQueue<T> {
    private readonly __inputQueue: Queue<T> = new Queue();
    private readonly __promiseQueue: Queue<Function> = new Queue();

    push(item: T) {
        if (this.__promiseQueue.length !== 0) this.__promiseQueue.pop()(item);
        else this.__inputQueue.push(item);
    }

    async pop(): Promise<T> {
        if (this.__inputQueue.length !== 0) return this.__inputQueue.pop();
        return new Promise((resolve, _reject) => {
            this.__promiseQueue.push(resolve);
        });
    }

    tryPop(): T | undefined {
        if (this.__inputQueue.length !== 0) return this.__inputQueue.pop();
        return undefined;
    }

    constructor() {
        this.push = this.push.bind(this);
    }
}
