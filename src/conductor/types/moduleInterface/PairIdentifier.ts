import type { Identifier } from "./Identifier";

/** An identifier for an extern pair. */
export type PairIdentifier = Identifier & { __brand: "pair" }; // apply branding so it's harder to mix identifiers up
