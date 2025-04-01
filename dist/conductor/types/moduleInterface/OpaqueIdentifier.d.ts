import type { Identifier } from "./Identifier";
/** An identifier for an extern opaque value. */
export type OpaqueIdentifier = Identifier & {
    __brand: "opaque";
};
