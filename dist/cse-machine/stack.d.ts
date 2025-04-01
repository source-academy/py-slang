/**
 * Stack is implemented for control and stash registers.
 */
interface IStack<T> {
    push(...items: T[]): void;
    pop(): T | undefined;
    peek(): T | undefined;
    size(): number;
    isEmpty(): boolean;
    getStack(): T[];
}
export declare class Stack<T> implements IStack<T> {
    storage: T[];
    constructor();
    push(...items: T[]): void;
    pop(): T | undefined;
    peek(): T | undefined;
    size(): number;
    isEmpty(): boolean;
    getStack(): T[];
    some(predicate: (value: T) => boolean): boolean;
    setTo(otherStack: Stack<T>): void;
}
export {};
