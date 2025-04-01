import * as es from 'estree';
/**
 * Python style dictionary
 */
export default class Dict<K, V> {
    private readonly internalMap;
    constructor(internalMap?: Map<K, V>);
    get size(): number;
    [Symbol.iterator](): MapIterator<[K, V]>;
    get(key: K): V | undefined;
    set(key: K, value: V): Map<K, V>;
    has(key: K): boolean;
    /**
     * Similar to how the python dictionary's setdefault function works:
     * If the key is not present, it is set to the given value, then that value is returned
     * Otherwise, `setdefault` returns the value stored in the dictionary without
     * modifying it
     */
    setdefault(key: K, value: V): NonNullable<V>;
    update(key: K, defaultVal: V, updater: (oldV: V) => V): V;
    entries(): [K, V][];
    forEach(func: (key: K, value: V) => void): void;
    /**
     * Similar to `mapAsync`, but for an async mapping function that does not return any value
     */
    forEachAsync(func: (k: K, v: V, index: number) => Promise<void>): Promise<void>;
    map<T>(func: (key: K, value: V, index: number) => T): T[];
    /**
     * Using a mapping function that returns a promise, transform a map
     * to another map with different keys and values. All calls to the mapping function
     * execute asynchronously
     */
    mapAsync<U>(func: (key: K, value: V, index: number) => Promise<U>): Promise<Awaited<U>[]>;
    flatMap<U>(func: (key: K, value: V, index: number) => U[]): U[];
}
/**
 * Convenience class for maps that store an array of values
 */
export declare class ArrayMap<K, V> extends Dict<K, V[]> {
    add(key: K, item: V): void;
}
export declare function filterImportDeclarations({ body }: es.Program): [
    ArrayMap<string, es.ImportDeclaration>,
    Exclude<es.Program['body'][0], es.ImportDeclaration>[]
];
