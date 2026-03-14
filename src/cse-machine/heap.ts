import { Closure } from "./closure";
import { Environment } from "./environment";
import { Value } from "./stash";

// Every array also has the properties `id` and `environment` for use in the frontend CSE Machine
export type EnvArray = (Value & {
  readonly id: string;
  environment: Environment;
})[];

// Objects in the heap can only store arrays or closures
export type HeapObject = EnvArray | Closure;

/**
 * The heap stores all objects in each environment.
 */
export class Heap<T extends HeapObject = HeapObject> {
  private storage: Set<T> | null = null;

  public constructor() {}

  add(...items: T[]): void {
    this.storage ??= new Set<T>();
    for (const item of items) {
      this.storage.add(item);
    }
  }

  /** Checks the existence of `item` in the heap. */
  contains(item: T): boolean {
    return this.storage?.has(item) ?? false;
  }

  /** Gets the number of items in the heap. */
  size(): number {
    return this.storage?.size ?? 0;
  }

  /**
   * Removes `item` from current heap and adds it to `otherHeap`.
   * If the current heap does not contain `item`, nothing happens.
   * @returns whether the item transfer is successful
   */
  move(item: T, otherHeap: Heap<T>): boolean {
    if (!this.contains(item)) return false;
    this.storage!.delete(item);
    otherHeap.add(item);
    return true;
  }

  /** Returns a copy of the heap's contents. */
  getHeap(): Set<T> {
    return new Set(this.storage);
  }
}
