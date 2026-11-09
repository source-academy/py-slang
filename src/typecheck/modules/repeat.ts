import type { ModuleDescription } from "../module-description";
import { fn, fun, parameter } from "./helpers";

const A = parameter("A");
/** The functions that repeat a function apply it to its own results: they work for any one type. */
const Endo = fun([A], A);

/**
 * TEMPORARY: the types of `repeat`, written by hand from the plugin's declarations (index.ts). The
 * function that is repeated takes and gives the same type `A`. `n` is a whole number (the module
 * rejects anything else). To be removed when the module publishes its own description
 * (source-academy/modules#996).
 */
export const REPEAT: ModuleDescription = {
  version: 1,
  module: "repeat",
  opaqueTypes: [],
  functions: [
    fn(
      "repeat",
      [
        ["func", Endo],
        ["n", "integer"],
      ],
      Endo,
      ["A"],
    ),
    fn(
      "repeat_apply",
      [
        ["func", Endo],
        ["n", "integer"],
        ["x", A],
      ],
      A,
      ["A"],
    ),
    fn("twice", [["func", Endo]], Endo, ["A"]),
    fn("thrice", [["func", Endo]], Endo, ["A"]),
  ],
  constants: [],
};
