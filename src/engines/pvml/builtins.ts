import { numericCompare } from "../cse/utils";
import { toPythonString } from "../../stdlib/utils";
import { PyComplexNumber } from "../../types";
import { pvmlBoxToCseValue } from "./cse-interop";
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
 * `str`/`repr` point at two of native Pynter's unimplemented stubs (index 90
 * `stringify`, index 91 `prompt`; both `sivmfn_prim_unimpl`) rather than
 * being left out entirely: SICPy preludes (e.g. linked-list.prelude.ts's
 * `llist_to_string`) reference `repr()`, and PVMLCompiler compiles a whole
 * file eagerly — leaving the name out would block every function in the
 * prelude from compiling, not just the one that calls it. Pointing them at
 * unimplemented-but-real stub slots lets compilation succeed for both
 * targets; a `targetsPynter`-compiled program calling either one still
 * faults cleanly if it ever reaches real Pynter, exactly as before. They
 * need genuinely different indices (not both 90, as before this file's own
 * TS-side str()/repr() implementation existed) because this file's
 * `executePrimitive` dispatches on primitive index alone, and str()/repr()
 * differ in one respect a shared index can't distinguish: a *bare* string
 * argument is quoted by repr() but not str() (e.g. `str("a")` -> `a`,
 * `repr("a")` -> `'a'`) — see cse-interop.ts/src/stdlib/utils.ts's
 * toPythonString. `prompt` (index 91, i.e. Python's `input()`) has no
 * PRIMITIVE_FUNCTIONS entry of its own, so borrowing its stub slot for
 * `repr` doesn't take anything away from a real feature.
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
 *
 * `complex`/`real`/`imag` (complex-number construction/decomposition — see
 * cse-interop.ts and PVMLType.COMPLEX) have no Pynter equivalent whatsoever
 * (unlike is_integer/is_float/etc. above, there isn't even an unimplemented
 * stub for them) and native Pynter never will, per this project's explicit
 * split: Pynter targets 32-bit embedded hardware, complex numbers are a
 * "full power of the desktop browser" pathway feature. Their indices
 * (97/98/99) are simply the next free numbers past Pynter's real dispatch
 * table (SIVMFN_PRIMITIVE_COUNT = 97) — safe because op_call_p bounds-checks
 * the primitive index before dispatch (pynter/vm/src/vm.c's
 * do_internal_function) and faults cleanly on an out-of-range one, exactly
 * like calling into a real unimplemented stub would.
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
  ["str", 90], // Unimplemented native "stringify" stub; see comment above.
  ["repr", 91], // Unimplemented native "prompt" stub, borrowed; see comment above.
  ["tail", 89],
  ["pair", 68],
  ["is_integer", 92],
  ["is_float", 93],
  ["is_complex", 94],
  ["real", 97],
  ["imag", 98],
  ["complex", 99],
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

/**
 * Coerces int (bigint) args to float (Number) for builtins that are
 * inherently floating-point (the math_* functions, round(), etc. — CPython's
 * own `math` module always returns a float regardless of int/float input).
 * Precision loss for huge bigints here matches that same float-coercion
 * behavior, not a shortcut. Builtins that must preserve Python `int`-ness of
 * their result (e.g. range()) use their own bigint-preserving arg check
 * instead — see assertIntArgs below.
 */
function assertNumericArgs(args: PVMLBoxType[], fn: string): number[] {
  if (!args.every(a => typeof a === "number" || typeof a === "bigint"))
    throw new PVMLInterpreterError(`TypeError: ${fn}() requires numeric arguments`);
  return args.map(a => Number(a));
}

/** Requires every arg to be a Python `int` — used by range(), which raises
 * TypeError on a float argument in CPython too (range(3.0) is an error), and
 * whose result must stay int-typed throughout (see NEWITER/FOR_ITER's
 * "range"-kind PVMLIterator). Normally that means a genuine `bigint` (see
 * PVMLType.BIGINT); a plain `number` is also accepted and treated as already
 * being an int, since `targetsPynter`-compiled bytecode (PVMLCompiler) has no
 * way to represent int/float differently at this value level at all (that
 * distinction only lives in real Pynter's own NaN-boxing) — this lets
 * Pynter-targeted bytecode still run correctly if ever executed directly by
 * this TS interpreter instead of the native VM (e.g. assembler round-trip
 * tests), at the cost of not rejecting a genuine Pynter-mode float there. */
function assertIntArgs(args: PVMLBoxType[], fn: string): bigint[] {
  if (!args.every(a => typeof a === "bigint" || typeof a === "number"))
    throw new PVMLInterpreterError(`TypeError: ${fn}() requires integer arguments`);
  return args.map(a => (typeof a === "bigint" ? a : BigInt(a)));
}

/** Converts an int/float/bool/complex value to PyComplexNumber, for the
 * complex() constructor (case 99) — mirrors the non-string branches of
 * PyComplexNumber.fromValue (src/types/value-types.ts) exactly, but without
 * that method's Context/handleRuntimeError coupling (which PVML has no
 * equivalent of); the string-parsing branch isn't needed here since
 * complex(real, imag) never takes a string operand (that's only the
 * one-argument `complex("3+4j")` form, which this primitive doesn't
 * implement). Returns undefined for anything else. */
function toPyComplexOperand(value: PVMLBoxType): PyComplexNumber | undefined {
  if (value instanceof PyComplexNumber) return value;
  if (typeof value === "boolean") return new PyComplexNumber(value ? 1 : 0, 0);
  if (typeof value === "number") return PyComplexNumber.fromNumber(value);
  if (typeof value === "bigint") return PyComplexNumber.fromBigInt(value);
  return undefined;
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

/** max()/min(): picks the winning argument by value (via the CSE-shared
 * `numericCompare`, which correctly orders bigint against float) and returns
 * it unchanged — preserving whichever int/float type it already was, unlike
 * assertNumericArgs' float coercion (matches CSE's max()/min() in
 * src/stdlib/misc.ts, which likewise return the original Value). */
function pickExtremum(args: PVMLBoxType[], fn: string, wantMax: boolean): PVMLBoxType {
  if (!args.every(a => typeof a === "number" || typeof a === "bigint"))
    throw new PVMLInterpreterError(`TypeError: ${fn}() requires numeric arguments`);
  let best = args[0];
  for (let i = 1; i < args.length; i++) {
    const cur = args[i];
    const cmp = numericCompare(cur, best);
    if (wantMax ? cmp > 0 : cmp < 0) best = cur;
  }
  return best;
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

    case 21: // is_number — true for int (bigint), float (number) or complex, not bool.
      // Mirrors CSE's is_number() (misc.ts): the full numeric tower.
      return (
        typeof args[0] === "number" ||
        typeof args[0] === "bigint" ||
        args[0] instanceof PyComplexNumber
      );

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

    case 90: // str — reuses the CSE machine's own formatting logic (see
      // cse-interop.ts's doc comment for why/how) rather than re-deriving
      // Python's float/string/list formatting rules from scratch.
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("str() takes exactly 1 argument");
      return toPythonString(pvmlBoxToCseValue(args[0]), false);

    case 91: // repr — see str() above; differs only in quoting a bare string
      // argument (see PRIMITIVE_FUNCTIONS' doc comment).
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("repr() takes exactly 1 argument");
      return toPythonString(pvmlBoxToCseValue(args[0]), true);

    case 92: // is_integer — true only for a genuine int (bigint), matching
      // CSE's is_integer() (misc.ts). A whole-valued float (e.g. `2.0`) is
      // still a float in Python, so no longer checked via Number.isInteger()
      // now that int/float are distinct runtime types (see PVMLType.BIGINT).
      return typeof args[0] === "bigint";

    case 93: // is_float — true only for a genuine float (number); see is_integer above.
      return typeof args[0] === "number";

    case 94: // is_complex
      return args[0] instanceof PyComplexNumber;

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

    case 97: // real — the real part of a complex number, as a float. Matches
      // CSE's real() (misc.ts): requires a genuine complex argument.
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("real() takes exactly 1 argument");
      if (!(args[0] instanceof PyComplexNumber))
        throw new PVMLInterpreterError(
          `TypeError: real() argument must be complex, not '${getPVMLType(args[0])}'`,
        );
      return args[0].real;

    case 98: // imag — see real() above.
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("imag() takes exactly 1 argument");
      if (!(args[0] instanceof PyComplexNumber))
        throw new PVMLInterpreterError(
          `TypeError: imag() argument must be complex, not '${getPVMLType(args[0])}'`,
        );
      return args[0].imag;

    case 99: {
      // complex(real, imag) — the constructor form (as distinct from the
      // `a+bj` literal syntax, compiled via LGCC — see PVMLCompiler's
      // visitComplexExpr). Matches CSE's complex() (misc.ts): real + imag*i.
      if (args.length !== 2)
        throw new MissingRequiredPositionalError("complex() takes exactly 2 arguments");
      const realPart = toPyComplexOperand(args[0]);
      const imagPart = toPyComplexOperand(args[1]);
      if (!realPart || !imagPart)
        throw new PVMLInterpreterError(
          "TypeError: complex() arguments must be int, float, bool or complex",
        );
      return realPart.add(imagPart.mul(new PyComplexNumber(0, 1)));
    }

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
      const [a, b, c] = assertIntArgs(args, "range");
      const [start, stop, step] =
        args.length === 1 ? [0n, a, 1n] : args.length === 2 ? [a, b, 1n] : [a, b, c];
      if (step === 0n) throw new PVMLInterpreterError("ValueError: range() arg 3 must not be zero");
      return { type: "iterator", kind: "range", current: start, stop, step };
    }

    case 32: {
      // abs — preserves int/float type (matches CSE's abs() in misc.ts:
      // bigint stays bigint, at full precision); a complex argument's abs()
      // is its modulus (a float), matching CSE and CPython.
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("abs() takes exactly 1 argument");
      const [x] = args;
      if (typeof x === "bigint") return x < 0n ? -x : x;
      if (typeof x === "number") return Math.abs(x);
      if (x instanceof PyComplexNumber) return Math.sqrt(x.real * x.real + x.imag * x.imag);
      throw new PVMLInterpreterError("TypeError: abs() requires numeric arguments");
    }
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
      return pickExtremum(args, "max", true);
    }

    case 56: {
      // min
      if (args.length < 2)
        throw new MissingRequiredPositionalError(
          `min() takes at least 2 arguments (${args.length} given)`,
        );
      return pickExtremum(args, "min", false);
    }

    case 57: // math_pow
      return binaryMath(args, "math_pow", Math.pow);

    case 58: // random_random
      return Math.random();

    case 59: {
      // round (1-arg form, matching this primitive's signature): banker's
      // rounding (round-half-to-even) to the nearest int, always returning a
      // bigint regardless of whether the input was int or float — mirrors
      // CSE's round() with no ndigits (misc.ts). Plain Math.round() would be
      // wrong here twice over: it rounds .5 away from zero instead of to
      // even, and it returns a float instead of Python's int result.
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("round() takes exactly 1 argument");
      const [x] = args;
      if (typeof x !== "number" && typeof x !== "bigint")
        throw new PVMLInterpreterError("TypeError: round() requires numeric arguments");
      const shifted = new Intl.NumberFormat("en-US", {
        roundingMode: "halfEven",
        useGrouping: false,
        maximumFractionDigits: 0,
      } as Intl.NumberFormatOptions).format(x);
      return BigInt(shifted);
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
