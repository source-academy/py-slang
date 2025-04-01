import { DataType, TypedValue } from "../types";

export function mNumber(value: number): TypedValue<DataType.NUMBER> {
    return {
        type: DataType.NUMBER,
        value
    };
}
