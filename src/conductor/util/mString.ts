// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { DataType, TypedValue } from "../types";

export function mString(value: string): TypedValue<DataType.CONST_STRING> {
    return {
        type: DataType.CONST_STRING,
        value
    };
}
