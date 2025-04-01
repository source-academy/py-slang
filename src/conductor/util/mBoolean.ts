import { DataType, TypedValue } from "../types";

export function mBoolean(value: boolean): TypedValue<DataType.BOOLEAN> {
    return {
        type: DataType.BOOLEAN,
        value
    };
}
