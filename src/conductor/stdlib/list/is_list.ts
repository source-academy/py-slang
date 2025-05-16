import { DataType, IDataHandler, List } from "../../types"

/**
 * Checks if a List is a true list (`tail(tail...(xs))` is empty-list).
 * @param xs The List to check.
 * @returns true if the provided List is a true list.
 */
export function is_list(this: IDataHandler, xs: List): boolean {
    if (xs === null) return true; // TODO: figure out some way to avoid JS value comparison
    while (true) {
        const tail = this.pair_tail(xs);
        if (tail.type === DataType.EMPTY_LIST) return true;
        if (tail.type !== DataType.PAIR) return false;
        xs = tail.value;
    }
}
