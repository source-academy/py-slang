import { ArrayIdentifier, DataType, IDataHandler } from "../../types";
export declare function array_assert<T extends DataType>(this: IDataHandler, a: ArrayIdentifier<DataType>, type?: T, length?: number): asserts a is ArrayIdentifier<T>;
