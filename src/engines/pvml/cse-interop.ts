import { Environment } from "../cse/environment";
import { BuiltinValue, FunctionValue, Value } from "../cse/stash";
import { PyComplexNumber } from "../../types";
import { PRIMITIVE_FUNCTIONS } from "./builtins";
import { isPVMLObject, PVMLBoxType } from "./types";

/**
 * A placeholder Environment satisfying FunctionValue's `env` field
 * structurally. Never dereferenced: toPythonString()/stringify() (see
 * src/stdlib/utils.ts and src/utils/stringify.ts) only ever read a
 * "function"-typed Value's `name` when formatting it, never `params`/`body`/
 * `env` — so this exists purely to satisfy the type, not to be used.
 */
const PLACEHOLDER_ENV: Environment = { id: "pvml", name: "pvml", tail: null, head: {} };

function functionDisplayValue(name: string): FunctionValue {
  return { type: "function", name, params: [], body: [], env: PLACEHOLDER_ENV };
}

/** Reverse of PRIMITIVE_FUNCTIONS (builtins.ts): primitive index -> a name to
 * display when a bare reference to it (e.g. `f = abs`) is str()'d/repr()'d.
 * A few indices have more than one name (e.g. print/display both -> 5); any
 * one of them is a fine display name, so ties just take last-write-wins.
 * Built lazily (not at module load) because builtins.ts and this module
 * import each other — computing this eagerly at top level would run before
 * builtins.ts has finished populating PRIMITIVE_FUNCTIONS. */
let primitiveNames: ReadonlyMap<number, string> | undefined;
function primitiveNameOf(primitiveIndex: number): string | undefined {
  if (!primitiveNames) {
    primitiveNames = new Map(Array.from(PRIMITIVE_FUNCTIONS, ([name, index]) => [index, name]));
  }
  return primitiveNames.get(primitiveIndex);
}

/** Never dereferenced by toPythonString/stringify's "builtin" case — see
 * functionDisplayValue's doc comment for why that's safe to fake here. */
function builtinDisplayValue(primitiveIndex: number): BuiltinValue {
  return {
    type: "builtin",
    name: primitiveNameOf(primitiveIndex) ?? `#${primitiveIndex}`,
    func: () => undefined,
    minArgs: 0,
  };
}

/**
 * Converts a PVML runtime value into the CSE machine's `Value` shape, so
 * str()/repr() (see builtins.ts) can reuse the CSE machine's own formatting
 * logic — src/stdlib/utils.ts's toPythonString (float/string/bool/None
 * formatting) and, for lists, src/utils/stringify.ts — instead of
 * re-deriving Python's formatting rules from scratch.
 *
 * Closures/primitives are the one case that can't be converted faithfully: a
 * real CSE ClosureValue carries an actual bound Environment and AST node
 * reference, which PVML's own closures (compiled bytecode + a resolved
 * PVMLIR, not an AST node) don't have. Since toPythonString/stringify only
 * ever read a "function"-typed Value's `name` when formatting it (never
 * `params`/`body`/`env`), a `FunctionValue` carrying the closure's real
 * declared name (see PVMLIR's `functionName`) and inert placeholders for the
 * rest renders identically to the real thing without needing any of CSE's
 * closure machinery.
 */
export function pvmlBoxToCseValue(value: PVMLBoxType): Value {
  if (value === null || value === undefined) {
    return { type: "none" };
  }
  if (typeof value === "number") {
    return { type: "number", value };
  }
  if (typeof value === "bigint") {
    return { type: "bigint", value };
  }
  if (typeof value === "boolean") {
    return { type: "bool", value };
  }
  if (typeof value === "string") {
    return { type: "string", value };
  }
  if (value instanceof PyComplexNumber) {
    return { type: "complex", value };
  }
  if (isPVMLObject(value)) {
    switch (value.type) {
      case "array":
        return { type: "list", value: value.elements.map(pvmlBoxToCseValue) };
      case "closure":
        return functionDisplayValue(value.ir.functionName);
      case "primitive":
        return builtinDisplayValue(value.primitiveIndex);
      case "iterator":
        throw new Error("TypeError: cannot convert an iterator to a string");
      // An imported-module handle: maps onto the CSE machine's own "opaque"
      // stash Value, so str()/print() render it the same "<opaque object>"
      // fallback toPythonString gives CSE module values.
      case "opaque":
        return { type: "opaque", value: value.value };
      // An imported-module function: renders as "<built-in function name>",
      // same as CSE shows for a module export bound to a name. The func/
      // minArgs fields are inert placeholders, never dereferenced — see
      // builtinDisplayValue's doc comment.
      case "extern":
        return { type: "builtin", name: value.name, func: () => undefined, minArgs: 0 };
    }
  }
  throw new Error(`TypeError: cannot convert PVML value of type '${typeof value}' to a string`);
}

/**
 * Converts a CSE machine `Value` into the PVML runtime value shape — the
 * reverse of `pvmlBoxToCseValue` above, used so PVML's parse()/tokenize()
 * (see builtins.ts) can reuse CSE's own `transform()` (src/stdlib/parser.ts)
 * directly instead of re-deriving its ~200-line AST-node-kind switch: PVML
 * calls the real `parse()` + `transform()`, then converts only the single
 * resulting `Value` tree through this function.
 *
 * `transform()`'s output only ever contains `string`/`number`/`bigint`/
 * `bool`/`none`/`complex`/`list` (pair-chain) values — never `closure`/
 * `builtin`/`iterator`/`function`/`error`/`multi_lambda` (a complex literal
 * in the parsed source, e.g. `3j`, does show up here: parser.ts's transform()
 * embeds it as a `complex` Value wrapping the same `PyComplexNumber` PVML
 * itself uses, see below) — so this converter is intentionally narrow,
 * matching exactly what a parsed-AST result can contain; anything else
 * throws rather than silently producing a wrong PVML value.
 */
export function cseValueToPvmlBox(value: Value): PVMLBoxType {
  switch (value.type) {
    case "none":
      return null;
    case "number":
    case "bigint":
    case "string":
    case "bool":
    case "complex":
      return value.value;
    case "list":
      return { type: "array", elements: value.value.map(cseValueToPvmlBox) };
    default:
      throw new Error(
        `TypeError: cannot convert CSE value of type '${value.type}' to a PVML value ` +
          `(parse()/tokenize() never produce this type)`,
      );
  }
}
