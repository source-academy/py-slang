import type { ArrayIdentifier, ClosureIdentifier, DataType, Identifier, NativeValue, OpaqueIdentifier, PairIdentifier } from ".";

/** A valid extern value. */
export type ExternValue = NativeValue | Identifier | PairIdentifier | ArrayIdentifier<DataType> | ClosureIdentifier<DataType> | OpaqueIdentifier;
