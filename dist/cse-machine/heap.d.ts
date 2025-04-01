import { Environment } from './environment';
import { Closure } from './closure';
export type EnvArray = any[] & {
    readonly id: string;
    environment: Environment;
};
export type HeapObject = EnvArray | Closure;
/**
 * The heap stores all objects in each environment.
 */
export declare class Heap {
    private storage;
    constructor();
    add(...items: HeapObject[]): void;
    /** Checks the existence of `item` in the heap. */
    contains(item: any): boolean;
    /** Gets the number of items in the heap. */
    size(): number;
    /**
     * Removes `item` from current heap and adds it to `otherHeap`.
     * If the current heap does not contain `item`, nothing happens.
     * @returns whether the item transfer is successful
     */
    move(item: HeapObject, otherHeap: Heap): boolean;
    /** Returns a copy of the heap's contents. */
    getHeap(): Set<HeapObject>;
}
