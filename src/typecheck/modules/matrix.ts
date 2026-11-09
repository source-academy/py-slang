import type { ModuleDescription } from "../module-description";
import { fn } from "./helpers";

/**
 * TEMPORARY: the types of `matrix` (the tone matrix), written by hand from the plugin's declarations
 * (index.ts, functions.ts): `get_matrix` gives a linked list of rows, bottom row first, each a linked
 * list of booleans (whether the square is ticked). To be removed when the module publishes its own
 * description (source-academy/modules#996).
 */
export const MATRIX: ModuleDescription = {
  version: 1,
  module: "matrix",
  opaqueTypes: [],
  functions: [fn("get_matrix", [], { list: { list: "boolean" } }), fn("clear_matrix", [], "void")],
  constants: [],
};
