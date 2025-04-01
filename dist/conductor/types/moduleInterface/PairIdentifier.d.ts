import type { Identifier } from "./Identifier";
/** An identifier for an extern pair. */
export type PairIdentifier = Identifier & {
    __brand: "pair";
};
