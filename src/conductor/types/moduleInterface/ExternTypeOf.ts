import type { ArrayIdentifier } from "./ArrayIdentifier";
import type { ClosureIdentifier } from "./ClosureIdentifier";
import { DataType } from "./DataType";
import { List } from "./List";
import type { OpaqueIdentifier } from "./OpaqueIdentifier";
import type { PairIdentifier } from "./PairIdentifier";

type typeMap = {
    [DataType.VOID]: void;
    [DataType.BOOLEAN]: boolean;
    [DataType.NUMBER]: number;
    [DataType.CONST_STRING]: string;
    [DataType.EMPTY_LIST]: null;
    [DataType.PAIR]: PairIdentifier;
    [DataType.ARRAY]: ArrayIdentifier<DataType>;
    [DataType.CLOSURE]: ClosureIdentifier<DataType>;
    [DataType.OPAQUE]: OpaqueIdentifier;
    [DataType.LIST]: List;
}

/** Maps the Conductor DataTypes to their corresponding native types. */
export type ExternTypeOf<T> = T extends DataType ? typeMap[T] : never;
