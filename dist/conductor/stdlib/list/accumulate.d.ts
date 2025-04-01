import { ClosureIdentifier, DataType, IDataHandler, TypedValue, List } from "../../types";
/**
 * Accumulates a Closure over a List.
 *
 * The Closure is applied in a right-to-left order - the first application
 * will be on the last element of the list and the given initial value.
 * @param op The Closure to use as an accumulator over the List.
 * @param initial The initial typed value (that is, the result of accumulating an empty List).
 * @param sequence The List to be accumulated over.
 * @param resultType The (expected) type of the result.
 * @returns A Promise resolving to the result of accumulating the Closure over the List.
 */
export declare function accumulate<T extends Exclude<DataType, DataType.VOID>>(this: IDataHandler, op: ClosureIdentifier<DataType>, initial: TypedValue<T>, sequence: List, resultType: T): Promise<TypedValue<T>>;
