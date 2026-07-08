import type { PVMLBoxType } from "./types";
import { getPVMLType, isPVMLObject, PVMLType } from "./types";
import { MissingRequiredPositionalError, PVMLInterpreterError } from "./errors";

/**
 * Maps canonical SICPy builtin names (as defined by the CSE machine's stdlib
 * groups, src/stdlib/misc.ts and src/stdlib/math.ts — see VARIANT_GROUPS[1]
 * in src/runner.ts) to PVML primitive opcode indices.
 *
 * These indices are NOT arbitrary: they must match the position of the
 * corresponding function in native Pynter's `sivmfn_primitives[]` dispatch
 * table (pynter/vm/src/primitives.c) exactly, since `CALLP`/`CALLTP` bake
 * this number into the bytecode and the native VM uses it as a raw array
 * index (see `sivmfn_primitives[ifn]` in pynter/vm/include/pynter/vm.h). A
 * name with no native equivalent (e.g. `str`, `input`, complex numbers) is
 * intentionally left out, so calling it surfaces as a clear
 * NameNotFoundError at analysis time rather than silently invoking whatever
 * unrelated native primitive happens to sit at a made-up index.
 *
 * `range` is a special case: for-loops compile it away entirely via the
 * NEWITER opcode (PVMLCompiler.visitForStmt), so this entry only matters for
 * range() called outside a for-loop, and only for this file's own TS-side
 * PVMLInterpreter — native Pynter has no primitive for it at all.
 *
 * `str`/`repr` point at native Pynter's unimplemented `stringify` stub
 * (index 90, `sivmfn_prim_unimpl`) rather than being left out: SICPy preludes
 * (e.g. linked-list.prelude.ts's `llist_to_string`) reference `repr()`, and
 * PVMLCompiler compiles a whole file eagerly — leaving the name out would
 * block every function in the prelude from compiling, not just the one that
 * calls it. Pointing it at the stub lets compilation succeed; it only faults
 * if actually called at runtime.
 *
 * `is_integer`/`is_float`/`is_complex`/`_gen_list` have no Source-standard-
 * library equivalent (Source's is_number() doesn't distinguish int/float,
 * Source has no complex numbers, and nothing builds a None-filled array), so
 * they were added as new native primitives appended to the end of Pynter's
 * dispatch table (see SIVMFN_PRIMITIVE_COUNT in
 * pynter/vm/include/pynter/internal_fn.h) rather than reused from an
 * existing slot.
 *
 * `is_list`/`list_length` (list.ts, over Python list literals, which PVML
 * represents as native's raw arrays) are deliberately mapped to native's
 * `is_array`/`array_length`, NOT native's own `is_list`(19)/`length`(26) —
 * those check "is/measure a proper cons-pair chain", which is the concept
 * py-slang's *linked-list* prelude (`is_llist`/`length`) uses instead.
 */
export const PRIMITIVE_FUNCTIONS: Map<string, number> = new Map([
  ["print", 5],
  ["display", 5], // Alias for print
  ["_gen_list", 95],
  ["arity", 96],
  ["error", 10],
  ["head", 14],
  ["is_list", 16], // Python list literal check; see note above.
  ["is_pair", 22],
  ["is_function", 18],
  ["is_boolean", 17],
  ["is_number", 21],
  ["is_string", 24],
  ["is_none", 20],
  ["len", 2],
  ["list_length", 2], // Same concept as len() for list.ts; see note above.
  ["llist", 27], // Native `list(...)` builds an identical null-terminated cons chain.
  ["range", 30],
  ["set_head", 74],
  ["set_tail", 75],
  ["stream", 76], // Variadic lazy-stream constructor; identical semantics to native's.
  ["str", 90], // Unimplemented native stub; see comment above.
  ["repr", 90],
  ["tail", 89],
  ["pair", 68],
  ["is_integer", 92],
  ["is_float", 93],
  ["is_complex", 94],
  ["abs", 32],
  ["math_acos", 33],
  ["math_acosh", 34],
  ["math_asin", 35],
  ["math_asinh", 36],
  ["math_atan", 37],
  ["math_atan2", 38],
  ["math_atanh", 39],
  ["math_cbrt", 40],
  ["math_ceil", 41],
  ["math_cos", 43],
  ["math_cosh", 44],
  ["math_exp", 45],
  ["math_expm1", 46],
  ["math_floor", 47],
  ["math_log", 51],
  ["math_log1p", 52],
  ["math_log2", 53],
  ["math_log10", 54],
  ["max", 55],
  ["min", 56],
  ["math_pow", 57],
  ["random_random", 58],
  ["round", 59],
  ["math_sin", 61],
  ["math_sinh", 62],
  ["math_sqrt", 63],
  ["math_tan", 64],
  ["math_tanh", 65],
  ["math_trunc", 66],
]);

function assertNumericArgs(args: PVMLBoxType[], fn: string): number[] {
  if (!args.every(a => typeof a === "number"))
    throw new PVMLInterpreterError(`TypeError: ${fn}() requires numeric arguments`);
  return args;
}

function unaryMath(args: PVMLBoxType[], name: string, fn: (x: number) => number): number {
  if (args.length !== 1)
    throw new MissingRequiredPositionalError(`${name}() takes exactly 1 argument`);
  const [x] = assertNumericArgs(args, name);
  return fn(x);
}

function binaryMath(
  args: PVMLBoxType[],
  name: string,
  fn: (a: number, b: number) => number,
): number {
  if (args.length !== 2)
    throw new MissingRequiredPositionalError(`${name}() takes exactly 2 arguments`);
  const [a, b] = assertNumericArgs(args, name);
  return fn(a, b);
}

/** A pair is represented as a 2-element PVMLArray, matching native Pynter's cons-array layout. */
function pairArray(v: PVMLBoxType, fn: string): Extract<PVMLBoxType, { type: "array" }> {
  if (!isPVMLObject(v) || v.type !== "array" || v.elements.length !== 2)
    throw new PVMLInterpreterError(`TypeError: ${fn}() requires a pair argument`);
  return v;
}

function pairElement(args: PVMLBoxType[], name: string, index: 0 | 1): PVMLBoxType {
  if (args.length !== 1)
    throw new MissingRequiredPositionalError(`${name}() takes exactly 1 argument`);
  return pairArray(args[0], name).elements[index];
}

/**
 * Execute a primitive function.
 * Called by the TypeScript interpreter for primitive operations.
 */
export function executePrimitive(
  primitiveIndex: number,
  args: PVMLBoxType[],
  sendOutput: (message: string) => void,
): PVMLBoxType {
  switch (primitiveIndex) {
    case 2: {
      // len / list_length
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("len() takes exactly 1 argument");
      const v = args[0];
      if (isPVMLObject(v) && v.type === "array") return v.elements.length;
      throw new PVMLInterpreterError(`TypeError: object of type '${getPVMLType(v)}' has no len()`);
    }

    case 5: // print/display
      sendOutput(args.join(" "));
      return undefined;

    case 10: // error
      throw new PVMLInterpreterError(`Error: ${args.map(String).join(" ")}`);

    case 14: // head
      return pairElement(args, "head", 0);

    case 16: // is_list
      return isPVMLObject(args[0]) && args[0].type === "array";

    case 17: // is_boolean
      return getPVMLType(args[0]) === PVMLType.BOOLEAN;

    case 18: // is_function
      return (
        getPVMLType(args[0]) === PVMLType.CLOSURE || getPVMLType(args[0]) === PVMLType.PRIMITIVE
      );

    case 20: // is_none
      return getPVMLType(args[0]) === PVMLType.NULL;

    case 21: // is_number
      return getPVMLType(args[0]) === PVMLType.NUMBER;

    case 22: // is_pair
      return isPVMLObject(args[0]) && args[0].type === "array" && args[0].elements.length === 2;

    case 24: // is_string
      return getPVMLType(args[0]) === PVMLType.STRING;

    case 27: // llist
      return args.reduceRight<PVMLBoxType>(
        (acc, x) => ({ type: "array", elements: [x, acc] }),
        null,
      );

    case 68: // pair
      if (args.length !== 2)
        throw new MissingRequiredPositionalError("pair() takes exactly 2 arguments");
      return { type: "array", elements: [args[0], args[1]] };

    case 74: // set_head
      if (args.length !== 2)
        throw new MissingRequiredPositionalError("set_head() takes exactly 2 arguments");
      pairArray(args[0], "set_head").elements[0] = args[1];
      return undefined;

    case 75: // set_tail
      if (args.length !== 2)
        throw new MissingRequiredPositionalError("set_tail() takes exactly 2 arguments");
      pairArray(args[0], "set_tail").elements[1] = args[1];
      return undefined;

    case 89: // tail
      return pairElement(args, "tail", 1);

    case 90: // str/repr: unimplemented, mirrors native Pynter's stringify stub
      throw new PVMLInterpreterError(
        "NotImplementedError: str()/repr() are not yet supported by the PVML/Pynter backend",
      );

    case 92: // is_integer
      return typeof args[0] === "number" && Number.isInteger(args[0]);

    case 93: // is_float
      return typeof args[0] === "number" && !Number.isInteger(args[0]);

    case 94: // is_complex: PVML has no complex number representation
      return false;

    case 95: {
      // _gen_list
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("_gen_list() takes exactly 1 argument");
      const [n] = assertNumericArgs(args, "_gen_list");
      return { type: "array", elements: new Array(n).fill(null) };
    }

    case 96: // arity: not implemented here (no access to function IR from this scope)
      throw new PVMLInterpreterError(
        "NotImplementedError: arity() is not yet supported by the PVML/Pynter backend",
      );

    case 76: // stream: needs a runtime-synthesized continuation closure, which this
      // TS interpreter can't create (closures reference statically compiled bytecode
      // functions by index) — native Pynter can, since C continuations are built
      // dynamically. No existing TS-interpreter-only test exercises this.
      throw new PVMLInterpreterError(
        "NotImplementedError: stream() is not yet supported by this TS interpreter",
      );

    case 30: {
      // range
      if (args.length < 1 || args.length > 3)
        throw new MissingRequiredPositionalError(
          `range() takes 1 to 3 arguments (${args.length} given)`,
        );
      const [a, b, c] = assertNumericArgs(args, "range");
      const [start, stop, step] =
        args.length === 1 ? [0, a, 1] : args.length === 2 ? [a, b, 1] : [a, b, c];
      if (step === 0) throw new PVMLInterpreterError("ValueError: range() arg 3 must not be zero");
      return { type: "iterator", kind: "range", current: start, stop, step };
    }

    case 32: // abs
      return unaryMath(args, "abs", Math.abs);
    case 33: // math_acos
      return unaryMath(args, "math_acos", Math.acos);
    case 34: // math_acosh
      return unaryMath(args, "math_acosh", Math.acosh);
    case 35: // math_asin
      return unaryMath(args, "math_asin", Math.asin);
    case 36: // math_asinh
      return unaryMath(args, "math_asinh", Math.asinh);
    case 37: // math_atan
      return unaryMath(args, "math_atan", Math.atan);
    case 38: // math_atan2
      return binaryMath(args, "math_atan2", Math.atan2);
    case 39: // math_atanh
      return unaryMath(args, "math_atanh", Math.atanh);
    case 40: // math_cbrt
      return unaryMath(args, "math_cbrt", Math.cbrt);
    case 41: // math_ceil
      return unaryMath(args, "math_ceil", Math.ceil);
    case 43: // math_cos
      return unaryMath(args, "math_cos", Math.cos);
    case 44: // math_cosh
      return unaryMath(args, "math_cosh", Math.cosh);
    case 45: // math_exp
      return unaryMath(args, "math_exp", Math.exp);
    case 46: // math_expm1
      return unaryMath(args, "math_expm1", Math.expm1);
    case 47: // math_floor
      return unaryMath(args, "math_floor", Math.floor);
    case 51: // math_log
      return unaryMath(args, "math_log", Math.log);
    case 52: // math_log1p
      return unaryMath(args, "math_log1p", Math.log1p);
    case 53: // math_log2
      return unaryMath(args, "math_log2", Math.log2);
    case 54: // math_log10
      return unaryMath(args, "math_log10", Math.log10);

    case 55: {
      // max
      if (args.length < 2)
        throw new MissingRequiredPositionalError(
          `max() takes at least 2 arguments (${args.length} given)`,
        );
      return Math.max(...assertNumericArgs(args, "max"));
    }

    case 56: {
      // min
      if (args.length < 2)
        throw new MissingRequiredPositionalError(
          `min() takes at least 2 arguments (${args.length} given)`,
        );
      return Math.min(...assertNumericArgs(args, "min"));
    }

    case 57: // math_pow
      return binaryMath(args, "math_pow", Math.pow);

    case 58: // random_random
      return Math.random();

    case 59: {
      // round
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("round() takes exactly 1 argument");
      const [n] = assertNumericArgs(args, "round");
      return Math.round(n);
    }

    case 61: // math_sin
      return unaryMath(args, "math_sin", Math.sin);
    case 62: // math_sinh
      return unaryMath(args, "math_sinh", Math.sinh);
    case 63: // math_sqrt
      return unaryMath(args, "math_sqrt", Math.sqrt);
    case 64: // math_tan
      return unaryMath(args, "math_tan", Math.tan);
    case 65: // math_tanh
      return unaryMath(args, "math_tanh", Math.tanh);
    case 66: // math_trunc
      return unaryMath(args, "math_trunc", Math.trunc);

    default:
      throw new PVMLInterpreterError(`Unknown primitive function index: ${primitiveIndex}`);
  }
}
