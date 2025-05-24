// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { DataType, TypedValue, OpaqueIdentifier } from "../types";

export function mOpaque(value: OpaqueIdentifier): TypedValue<DataType.OPAQUE> {
    return {
        type: DataType.OPAQUE,
        value
    };
}
