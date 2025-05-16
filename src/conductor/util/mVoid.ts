import { DataType, TypedValue } from "../types";

export function mVoid(value: void = undefined): TypedValue<DataType.VOID> {
    return {
        type: DataType.VOID,
        value
    };
}
