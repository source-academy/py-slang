// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import type { DataType } from "./DataType";
import type { ExternTypeOf } from "./ExternTypeOf";

interface ITypedValue<T extends DataType> {
    type: T;
    value: ExternTypeOf<T>;
}

// export a type instead to benefit from distributive conditional type
export type TypedValue<T> = T extends DataType ? ITypedValue<T> : never;
