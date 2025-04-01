import { DataType, IDataHandler, TypedValue } from "../../types";
/**
 * Creates a new List from given elements.
 * @param elements The elements of the List, given as typed values.
 * @returns The newly created List.
 */
export declare function list(this: IDataHandler, ...elements: TypedValue<DataType>[]): TypedValue<DataType.LIST>;
