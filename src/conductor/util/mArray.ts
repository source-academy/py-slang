// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { ArrayIdentifier, DataType, TypedValue } from "../types";

export function mArray(value: ArrayIdentifier<DataType>): TypedValue<DataType.ARRAY> {
    return {
        type: DataType.ARRAY,
        value
    };
}
