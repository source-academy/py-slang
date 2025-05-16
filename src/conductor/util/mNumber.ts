// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { DataType, TypedValue } from "../types";

export function mNumber(value: number): TypedValue<DataType.NUMBER> {
    return {
        type: DataType.NUMBER,
        value
    };
}
