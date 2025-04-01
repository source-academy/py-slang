import type { DataType } from "./DataType";
import type { Identifier } from "./Identifier";

/** An identifier for an extern array. */
export type ArrayIdentifier<T extends DataType> = Identifier & { __brand: "array", __type: T }; // apply branding so it's harder to mix identifiers up
