import { DataType, TypedValue, PairIdentifier } from "../types";

export function mPair(value: PairIdentifier): TypedValue<DataType.PAIR> {
    return {
        type: DataType.PAIR,
        value
    };
}
