import { DataType, TypedValue, PairIdentifier } from "../types";

export function mList(value: PairIdentifier | null): TypedValue<DataType.LIST> {
    return {
        type: DataType.LIST,
        value
    };
}
