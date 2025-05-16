// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import type { Identifier } from "./Identifier";

/** An identifier for an extern opaque value. */
export type OpaqueIdentifier = Identifier & { __brand: "opaque" }; // apply branding so it's harder to mix identifiers up
