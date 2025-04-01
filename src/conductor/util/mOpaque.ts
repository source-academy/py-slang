import { DataType, TypedValue, OpaqueIdentifier } from "../types";

export function mOpaque(value: OpaqueIdentifier): TypedValue<DataType.OPAQUE> {
    return {
        type: DataType.OPAQUE,
        value
    };
}
