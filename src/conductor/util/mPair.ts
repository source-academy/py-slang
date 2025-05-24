// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { DataType, TypedValue, PairIdentifier } from "../types";

export function mPair(value: PairIdentifier): TypedValue<DataType.PAIR> {
    return {
        type: DataType.PAIR,
        value
    };
}
