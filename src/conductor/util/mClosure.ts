// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { ClosureIdentifier, DataType, TypedValue } from "../types";

export function mClosure(value: ClosureIdentifier<DataType>): TypedValue<DataType.CLOSURE> {
    return {
        type: DataType.CLOSURE,
        value
    };
}
