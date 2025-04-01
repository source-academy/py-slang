import { ArrayIdentifier, DataType, TypedValue } from "../types";

export function mArray(value: ArrayIdentifier<DataType>): TypedValue<DataType.ARRAY> {
    return {
        type: DataType.ARRAY,
        value
    };
}
