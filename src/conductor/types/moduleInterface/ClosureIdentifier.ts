// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import type { DataType } from "./DataType";
import type { Identifier } from "./Identifier";

/** An identifier for an extern closure. */
export type ClosureIdentifier<T extends DataType> = Identifier & { __brand: "closure", __ret: T }; // apply branding so it's harder to mix identifiers up
