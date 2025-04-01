import { DataType } from "../types";

export function isSameType(t1: DataType, t2: DataType): boolean {
    if (t1 === t2) return true;
    if (t1 === DataType.LIST && (t2 === DataType.PAIR || t2 === DataType.EMPTY_LIST)) return true;
    if (t2 === DataType.LIST && (t1 === DataType.PAIR || t1 === DataType.EMPTY_LIST)) return true;
    return false;
}
