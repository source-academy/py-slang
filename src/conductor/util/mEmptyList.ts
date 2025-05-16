// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { DataType, TypedValue } from "../types";

export function mEmptyList(value: null = null): TypedValue<DataType.EMPTY_LIST> {
    return {
        type: DataType.EMPTY_LIST,
        value
    };
}
