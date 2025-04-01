import { DataType, IDataHandler, TypedValue } from "../../types";
import { mList } from "../../util/mList";

/**
 * Creates a new List from given elements.
 * @param elements The elements of the List, given as typed values.
 * @returns The newly created List.
 */
export function list(this: IDataHandler, ...elements: TypedValue<DataType>[]): TypedValue<DataType.LIST> {
    let theList: TypedValue<DataType.LIST> = mList(null);
    for (let i = elements.length - 1; i >= 0; --i) {
        const p = mList(this.pair_make(elements[i], theList));
        theList = p;
    }
    return theList;
}
