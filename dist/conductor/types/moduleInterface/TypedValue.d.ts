import type { DataType } from "./DataType";
import type { ExternTypeOf } from "./ExternTypeOf";
interface ITypedValue<T extends DataType> {
    type: T;
    value: ExternTypeOf<T>;
}
export type TypedValue<T> = T extends DataType ? ITypedValue<T> : never;
export {};
