// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { DataType, TypedValue, PairIdentifier } from "../types";

export function mList(value: PairIdentifier | null): TypedValue<DataType.LIST> {
    return {
        type: DataType.LIST,
        value
    };
}
