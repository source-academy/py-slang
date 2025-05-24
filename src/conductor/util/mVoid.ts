// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { DataType, TypedValue } from "../types";

export function mVoid(value: void = undefined): TypedValue<DataType.VOID> {
    return {
        type: DataType.VOID,
        value
    };
}
