// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { DataType, TypedValue } from "../types";

export function mBoolean(value: boolean): TypedValue<DataType.BOOLEAN> {
    return {
        type: DataType.BOOLEAN,
        value
    };
}
