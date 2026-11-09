import type { ModuleDescription } from "../module-description";
import { fn, opaque, parameter } from "./helpers";

const A = parameter("A");
const Tree = opaque("BinaryTree", A);

/**
 * TEMPORARY: the types of `binary_tree`, written by hand from the plugin's declarations (index.ts).
 * A tree is a value that only the module's functions take apart, so it is an opaque type with the
 * type of its entries as a parameter (the plugin says `any` for the entries). `is_tree` and
 * `is_empty_tree` accept any value. To be removed when the module publishes its own description
 * (source-academy/modules#996).
 */
export const BINARY_TREE: ModuleDescription = {
  version: 1,
  module: "binary_tree",
  opaqueTypes: [{ name: "BinaryTree", typeParameters: ["A"] }],
  functions: [
    fn("make_empty_tree", [], Tree, ["A"]),
    fn(
      "make_tree",
      [
        ["value", A],
        ["left", Tree],
        ["right", Tree],
      ],
      Tree,
      ["A"],
    ),
    fn("is_tree", [["value", "any"]], "boolean"),
    fn("is_empty_tree", [["value", "any"]], "boolean"),
    fn("entry", [["t", Tree]], A, ["A"]),
    fn("left_branch", [["t", Tree]], Tree, ["A"]),
    fn("right_branch", [["t", Tree]], Tree, ["A"]),
  ],
  constants: [],
};
