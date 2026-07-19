import { erf, gamma, lgamma } from "mathjs";
import { friendlyTypeName } from "../cse/types";
import { numericCompare } from "../cse/utils";
import { minArgMap, toPythonString } from "../../stdlib/utils";
import { transform } from "../../stdlib/parser";
// Imported only for their module-load side effect of populating
// `minArgMap` (via each builtin's `@Validate` decorator, see stdlib/utils.ts)
// — used below to build PRIMITIVE_MIN_ARGS for arity(). `../../stdlib/parser`
// (imported above for `transform`) already covers the parser group's own
// names (parse/tokenize/apply_in_underlying_python).
import "../../stdlib/misc";
import "../../stdlib/math";
import "../../stdlib/linked-list";
import "../../stdlib/list";
import "../../stdlib/pairmutator";
import "../../stdlib/stream";
import { PyComplexNumber } from "../../types";
import { parse as parsePython } from "../../parser/parser-adapter";
import pythonLexer from "../../parser/lexer";
import { cseValueToPvmlBox, pvmlBoxToCseValue } from "./cse-interop";
import type { PVMLArray, PVMLBoxType } from "./types";
import { getPVMLType, isPVMLObject, PVMLType } from "./types";
import {
  MissingRequiredPositionalError,
  PVMLInterpreterError,
  ValueError,
  ZeroDivisionError,
} from "./errors";

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
 * `is_integer`/`is_float`/`is_complex` have no Source-standard-library
 * equivalent (Source's is_number() doesn't distinguish int/float, and Source
 * has no complex numbers), so they were added as new native primitives
 * appended to the end of Pynter's dispatch table (see
 * SIVMFN_PRIMITIVE_COUNT in pynter/vm/include/pynter/internal_fn.h) rather
 * than reused from an existing slot.
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
 *
 * `parse`/`tokenize`/`apply_in_underlying_python` (the chapter-4 metacircular
 * `parser` stdlib group, see src/stdlib/parser.ts and PyPvmlEvaluator4) are
 * the same story as complex/real/imag: no Pynter equivalent, indices past
 * the real table, safe via the same bounds-check. `parse`/`tokenize` reuse
 * CSE's own `transform()`/lexer directly rather than re-deriving Python's
 * AST-to-parse-tree conversion; `apply_in_underlying_python` is built on
 * PVMLInterpreter's `invokeValue` (see its doc comment) rather than CSE's
 * control/stash step-machine plumbing, which this interpreter has no
 * equivalent of and doesn't need one for this.
 */
export const PRIMITIVE_FUNCTIONS: Map<string, number> = new Map([
  ["print", 5],
  ["display", 5], // Alias for print
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
  // 100 is _concat_arrays, compiler-internal only (see PVMLCompiler's
  // compileSpreadCall) — deliberately no name entry here.
  ["parse", 101],
  ["tokenize", 102],
  ["apply_in_underlying_python", 103],
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
  // The Python `math` module functions below have no Source/native-Pynter
  // equivalent at all (Pynter's real math_* table is Source's — i.e.
  // JS Math.* — subset, matching what's mapped above this comment); same
  // "no native counterpart" situation as is_integer/is_float/real/imag/
  // complex/parse/tokenize above, so browser-pathway-only indices
  // past Pynter's real dispatch table, no native Pynter C-side change.
  ["math_degrees", 104],
  ["math_erf", 105],
  ["math_erfc", 106],
  ["math_comb", 107],
  ["math_factorial", 108],
  ["math_gcd", 109],
  ["math_isqrt", 110],
  ["math_lcm", 111],
  ["math_perm", 112],
  ["math_fabs", 113],
  ["math_fma", 114],
  ["math_fmod", 115],
  ["math_remainder", 116],
  ["math_copysign", 117],
  ["math_isfinite", 118],
  ["math_isinf", 119],
  ["math_isnan", 120],
  ["math_ldexp", 121],
  ["math_exp2", 122],
  ["math_gamma", 123],
  ["math_lgamma", 124],
  ["math_radians", 125],
  ["time_time", 126],
  // real/imag/complex/parse/tokenize/the math_* additions above were, as a new primitive appended
  // past native's own table, so this only backs py-slang's own local TS PVMLInterpreter until a
  // matching entry lands in the pynter repo.
  ["print_llist", 127],
  // `math_nextafter`/`math_ulp` are themselves unimplemented stubs on the CSE
  // side too (misc.ts/math.ts: both throw "not implemented" if actually
  // called) — registered here only so a *bare reference* to the name (e.g.
  // `arity(math_nextafter)`, which never calls it) compiles and reports the
  // correct arity, exactly mirroring CSE's own `@Validate` decorator on
  // these two. `input()` is a genuine, working CSE feature but needs real
  // async stdin plumbing (Context.streams — see input.test.ts) this
  // synchronous TS interpreter has no equivalent of; same reasoning applies:
  // registered for arity() introspection only. All three throw a clear
  // "not implemented"/"not supported" error below if ever actually called,
  // rather than silently misdispatching.
  ["math_nextafter", 128],
  ["math_ulp", 129],
  ["input", 130],
]);

/**
 * Primitive-index -> minimum-argument-count lookup used by `arity()` (case
 * 96 below) when its argument is a first-class primitive reference (e.g.
 * `arity(abs)`) rather than a closure. Derived from the CSE machine's own
 * `minArgMap` (stdlib/utils.ts, populated by each builtin's `@Validate`
 * decorator as a side effect of the side-effect-only stdlib imports above)
 * so the numbers can't drift from CSE's `arity()` (misc.ts) — a name with no
 * `@Validate` decorator (e.g. `str`, `error`, the async `display`) defaults
 * to CSE's own `minArgMap.get(builtin) || 0` fallback.
 */
const PRIMITIVE_MIN_ARGS: Map<number, number> = new Map(
  [...PRIMITIVE_FUNCTIONS.entries()].map(([name, index]) => [index, minArgMap.get(name) || 0]),
);

/**
 * Named numeric constants from the `math` stdlib group (src/stdlib/math.ts's
 * `constantMap`) — `math_pi`, `math_e`, etc. Unlike everything in
 * PRIMITIVE_FUNCTIONS above, these are referenced as plain values
 * (`math_pi + 1`), never called (`math_pi()` isn't valid Python) — so they
 * don't fit the primitive-function-call model at all. PVMLCompiler's
 * getTokenAnnotation checks this map before PRIMITIVE_FUNCTIONS and, for a
 * hit, emits the value directly (LGCF64) rather than a CALLP/NEWCP
 * primitive reference — see its `isConstant` CompilerAnnotation case.
 */
export const PRIMITIVE_CONSTANTS: Map<string, number> = new Map([
  ["math_e", Math.E],
  ["math_inf", Infinity],
  ["math_nan", NaN],
  ["math_pi", Math.PI],
  ["math_tau", 2 * Math.PI],
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
function assertNumericArgs(args: PVMLBoxType[], fn: string, variant: number = 4): number[] {
  const bad = args.find(a => typeof a !== "number" && typeof a !== "bigint");
  if (bad !== undefined) {
    throw new PVMLInterpreterError(
      `TypeError: unsupported argument type for ${fn}: ${friendlyTypeName(getPVMLType(bad), variant)}`,
    );
  }
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
function assertIntArgs(args: PVMLBoxType[], fn: string, variant: number = 4): bigint[] {
  const bad = args.find(a => typeof a !== "bigint" && typeof a !== "number");
  if (bad !== undefined) {
    throw new PVMLInterpreterError(
      `TypeError: unsupported argument type for ${fn}: ${friendlyTypeName(getPVMLType(bad), variant)}`,
    );
  }
  return args.map(a => (typeof a === "bigint" ? a : BigInt(a as number)));
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

/** Builds a null-terminated pair-chain (PVML's linked-list representation,
 * same 2-element-array shape as pair()) from a flat array — used by
 * tokenize() to return its token list. Mirrors src/stdlib/parser.ts's
 * vector_to_llist, for the same reason cse-interop.ts's converters exist:
 * matching output shape, different box type. */
function vectorToPvmlList(arr: PVMLBoxType[]): PVMLBoxType {
  let res: PVMLBoxType = null;
  for (let i = arr.length - 1; i >= 0; i--) {
    res = { type: "array", elements: [arr[i], res] };
  }
  return res;
}

/**
 * `domainCheck`, when given, mirrors CPython's own per-function domain
 * restriction for the handful of math_* functions that have one (e.g.
 * `math_acos`'s [-1, 1], `math_sqrt`'s [0, inf)) -- matches CSE's own
 * per-function ValueError checks in src/stdlib/math.ts, and CPython's own
 * `ValueError: math domain error` wording exactly. Previously missing here
 * entirely: every unaryMath call silently ran `fn(x)` out of domain and
 * returned NaN instead of raising, a real behavioral gap from both CSE and
 * real CPython (found via generatePvmlInBrowserTestCases while extending
 * stdlib.test.ts's mathTests coverage).
 */
function unaryMath(
  args: PVMLBoxType[],
  name: string,
  fn: (x: number) => number,
  variant: number = 4,
  domainCheck?: (x: number) => boolean,
): number {
  if (args.length !== 1)
    throw new MissingRequiredPositionalError(`${name}() takes exactly 1 argument`);
  const [x] = assertNumericArgs(args, name, variant);
  if (domainCheck && !Number.isNaN(x) && !domainCheck(x)) {
    throw new PVMLInterpreterError("ValueError: math domain error");
  }
  return fn(x);
}

function binaryMath(
  args: PVMLBoxType[],
  name: string,
  fn: (a: number, b: number) => number,
  variant: number = 4,
): number {
  if (args.length !== 2)
    throw new MissingRequiredPositionalError(`${name}() takes exactly 2 arguments`);
  const [a, b] = assertNumericArgs(args, name, variant);
  return fn(a, b);
}

function ternaryMath(
  args: PVMLBoxType[],
  name: string,
  fn: (a: number, b: number, c: number) => number,
  variant: number = 4,
): number {
  if (args.length !== 3)
    throw new MissingRequiredPositionalError(`${name}() takes exactly 3 arguments`);
  const [a, b, c] = assertNumericArgs(args, name, variant);
  return fn(a, b, c);
}

function unaryMathBool(
  args: PVMLBoxType[],
  name: string,
  fn: (x: number) => boolean,
  variant: number = 4,
): boolean {
  if (args.length !== 1)
    throw new MissingRequiredPositionalError(`${name}() takes exactly 1 argument`);
  const [x] = assertNumericArgs(args, name, variant);
  return fn(x);
}

/** Like unaryMath, but for the handful of math_* functions whose Python
 * result is always an int (math.floor/ceil/trunc) — matches CSE's own
 * math_floor/ceil/trunc (src/stdlib/math.ts), which return BigIntValue, not
 * NumberValue, unlike the float-returning math_* functions everything else
 * in this file wraps via plain unaryMath. An already-int argument passes
 * through unchanged (full precision preserved, matching CSE) rather than
 * round-tripping through Number — ceil/floor/trunc of an int is a no-op. */
function unaryMathToInt(
  args: PVMLBoxType[],
  name: string,
  fn: (x: number) => number,
  variant: number = 4,
): bigint {
  if (args.length !== 1)
    throw new MissingRequiredPositionalError(`${name}() takes exactly 1 argument`);
  const [x] = args;
  if (typeof x === "bigint") return x;
  if (typeof x !== "number")
    throw new PVMLInterpreterError(
      `TypeError: unsupported argument type for ${name}: ${friendlyTypeName(getPVMLType(x), variant)}`,
    );
  return BigInt(fn(x));
}

/** Euclidean algorithm, arbitrary precision — shared by math_gcd/math_lcm.
 * Mirrors CSE's _gcdOfTwo (src/stdlib/math.ts). Assumes non-negative inputs
 * (callers take the absolute value first). */
function gcdOfTwo(a: bigint, b: bigint): bigint {
  let x = a;
  let y = b;
  while (y !== 0n) {
    const temp = x % y;
    x = y;
    y = temp;
  }
  return x < 0n ? -x : x;
}

/** Banker's rounding (round-half-to-even) for a float — used by
 * math_remainder's IEEE-754 remainder definition. Mirrors CSE's
 * _roundToEven (src/stdlib/math.ts). */
function roundToEven(num: number): number {
  const floorVal = Math.floor(num);
  const ceilVal = Math.ceil(num);
  const diffFloor = num - floorVal;
  const diffCeil = ceilVal - num;
  if (diffFloor < diffCeil) return floorVal;
  if (diffCeil < diffFloor) return ceilVal;
  return floorVal % 2 === 0 ? floorVal : ceilVal;
}

/** Fused multiply-add via Dekker's algorithm (single rounding for x*y+z) —
 * used by math_fma. Mirrors CSE's _twoProd/_twoSum/_fusedMultiplyAdd
 * (src/stdlib/math.ts), collapsed into one function since PVML has no
 * equivalent need to expose the intermediates separately. */
function fusedMultiplyAdd(x: number, y: number, z: number): number {
  const prod = x * y;
  const c = 134217729; // 2^27 + 1
  const xHi = x * c - (x * c - x);
  const xLo = x - xHi;
  const yHi = y * c - (y * c - y);
  const yLo = y - yHi;
  const prodErr = xLo * yLo - (prod - xHi * yHi - xLo * yHi - xHi * yLo);

  const sum = prod + z;
  const v = sum - prod;
  const sumErr = prod - (sum - v) + (z - v);

  return sum + (prodErr + sumErr);
}

/** max()/min(): picks the winning argument by value (via the CSE-shared
 * `numericCompare`, which correctly orders bigint against float) and returns
 * it unchanged — preserving whichever int/float type it already was, unlike
 * assertNumericArgs' float coercion (matches CSE's max()/min() in
 * src/stdlib/misc.ts, which likewise return the original Value). CSE's
 * version compares with plain `>`/`<` on the underlying values; since JS's
 * `x > NaN`/`NaN > x` are always false in both directions, that gives it a
 * specific NaN behavior for free, with no special-casing: once the current
 * winner is NaN nothing can ever dethrone it (every later `cur > NaN`-style
 * comparison is false), while a NaN that's never held the "winning" slot is
 * simply skipped over (it can't beat anything either). `numericCompare` has
 * no such built-in NaN handling (its own doc comment requires callers to
 * check first), so this needs the explicit guard below to reproduce the same
 * behavior. */
function pickExtremum(
  args: PVMLBoxType[],
  fn: string,
  wantMax: boolean,
  variant: number = 4,
): PVMLBoxType {
  const allNumeric = args.every(a => typeof a === "number" || typeof a === "bigint");
  const allString = args.every(a => typeof a === "string");
  if (!allNumeric && !allString) {
    // Mirrors CSE's own max()/min() (misc.ts): the "wrong" type is whichever
    // argument doesn't match args[0]'s own kind — there's no single
    // universally-wrong argument here, just an inconsistent mix.
    const bad =
      typeof args[0] === "number" || typeof args[0] === "bigint"
        ? args.find(a => typeof a !== "number" && typeof a !== "bigint")!
        : typeof args[0] === "string"
          ? args.find(a => typeof a !== "string")!
          : args[0];
    throw new PVMLInterpreterError(
      `TypeError: unsupported argument type for ${fn}: ${friendlyTypeName(getPVMLType(bad), variant)}`,
    );
  }
  let best = args[0];
  for (let i = 1; i < args.length; i++) {
    const cur = args[i];
    if (allString) {
      // Plain JS `<`/`>` compares by UTF-16 code unit, matching CSE's own
      // max()/min() (misc.ts) — same as codepoint order for the BMP.
      if (wantMax ? (cur as string) > (best as string) : (cur as string) < (best as string))
        best = cur;
      continue;
    }
    if (typeof best === "number" && Number.isNaN(best)) continue;
    if (typeof cur === "number" && Number.isNaN(cur)) continue;
    const cmp = numericCompare(cur as number | bigint, best as number | bigint);
    if (wantMax ? cmp > 0 : cmp < 0) best = cur;
  }
  return best;
}

/** A pair is represented as a 2-element PVMLArray, matching native Pynter's cons-array layout. */
function pairArray(
  v: PVMLBoxType,
  fn: string,
  variant: number = 4,
): Extract<PVMLBoxType, { type: "array" }> {
  if (!isPVMLObject(v) || v.type !== "array" || v.elements.length !== 2)
    throw new PVMLInterpreterError(
      `TypeError: unsupported argument type for ${fn}: ${friendlyTypeName(getPVMLType(v), variant)}`,
    );
  return v;
}

function pairElement(
  args: PVMLBoxType[],
  name: string,
  index: 0 | 1,
  variant: number = 4,
): PVMLBoxType {
  if (args.length !== 1)
    throw new MissingRequiredPositionalError(`${name}() takes exactly 1 argument`);
  return pairArray(args[0], name, variant).elements[index];
}

function isArrayPair(v: PVMLBoxType): v is Extract<PVMLBoxType, { type: "array" }> {
  return isPVMLObject(v) && v.type === "array" && v.elements.length === 2;
}

/** Whether `v` is `None` or a pair whose tail is itself a proper linked list -- mirrors
 * linked-list.ts's `_is_llist` on the CSE side. Head shape is irrelevant: only the tail chain must
 * reach `None`, so e.g. `pair(llist(1, 2), llist(3, 4))` counts as a proper list of two elements.
 * Iterative -- `printLlistText` below calls this once per *distinct* tail-chain suffix it renders
 * (see its own doc comment), so a recursive version here would make the whole walk O(N^2) on a long
 * chain, and risk a stack overflow on a long chain by itself regardless. */
function isProperLlist(v: PVMLBoxType): boolean {
  let current = v;
  while (isArrayPair(current)) {
    current = current.elements[1];
  }
  return current === null;
}

/**
 * Python repr of a scalar (non-pair) leaf value for `print_llist`'s box-and-pointer text. PVML has
 * no general str()/repr() support (case 90 above is an unimplemented stub, matching native Pynter),
 * so this is deliberately minimal -- just the value shapes a linked-list leaf can actually be.
 */
function llistLeafRepr(v: PVMLBoxType): string {
  if (v === null || v === undefined) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (typeof v === "string") return `'${v.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  if (v instanceof PyComplexNumber) return v.toString();
  return "<function>";
}

/**
 * Box-and-pointer text for a linked list or pair, matching linked-list.ts's `_print_llist` on the
 * CSE side: a proper list (tail chain reaching `None`) renders as `llist(a, b, c)`; anything else
 * renders as `[head, tail]`, recursing the same way at every level (so a proper-list *element*, e.g.
 * inside an improper pair, still renders as `llist(...)`, not `[...]`). Plain recursion, no
 * memoization keyed by value/object identity -- see the case 97 comment for why that matters.
 *
 * `isKnownImproper` avoids re-running `isProperLlist` on every tail suffix while unrolling an
 * improper structure's bracket notation: once a tail position is known to continue an improper
 * chain, the rest of that chain can only ever be improper too, so `helper` skips straight to the
 * bracket case instead of re-walking the remaining tail to confirm it again. A *head* always gets a
 * fresh check (`isKnownImproper: false`), since it's an independent substructure that may itself be
 * a proper list.
 */
function printLlistText(v: PVMLBoxType): string {
  function helper(n: PVMLBoxType, isKnownImproper: boolean): string {
    if (isKnownImproper || !isProperLlist(n)) {
      if (!isArrayPair(n)) return llistLeafRepr(n);
      return `[${helper(n.elements[0], false)}, ${helper(n.elements[1], true)}]`;
    }

    const parts: string[] = [];
    let current = n;
    while (isArrayPair(current)) {
      parts.push(helper(current.elements[0], false));
      current = current.elements[1];
    }
    return `llist(${parts.join(", ")})`;
  }
  return helper(v, false);
}

/**
 * Execute a primitive function.
 * Called by the TypeScript interpreter for primitive operations.
 */
export function executePrimitive(
  primitiveIndex: number,
  args: PVMLBoxType[],
  sendOutput: (message: string) => void,
  /** Synchronously calls back into user Python code (a closure or another
   * primitive) — see PVMLInterpreter's invokeValue doc comment. Only
   * `apply_in_underlying_python` uses this; every other primitive ignores
   * it. */
  invokeValue: (func: PVMLBoxType, args: PVMLBoxType[]) => PVMLBoxType,
  /** The SICPy chapter (1-4) the running program was compiled for — see
   * Context.variant's doc comment (src/engines/cse/context.ts) for why
   * argument-type error messages need it (a "pair" and a length-2 "list" are
   * the exact same runtime value here). */
  variant: number = 4,
): PVMLBoxType {
  switch (primitiveIndex) {
    case 2: {
      // len / list_length — Python's len() returns an int, so this must be a bigint (matching
      // PVMLType.BIGINT), not a plain JS number: v.elements.length is a number, and printing it
      // unconverted silently produced a float ("5.0" instead of "5") -- a real bug JS's loose
      // 5 === 5.0 equality had been hiding from the old return-value-comparison test suite.
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("len() takes exactly 1 argument");
      const v = args[0];
      if (isPVMLObject(v) && v.type === "array") return BigInt(v.elements.length);
      // The spread operator counts Unicode code points, not UTF-16 code
      // units — matching CSE's own len() (misc.ts) and Python's str being a
      // sequence of code points (e.g. len('👋🌍') is 2, not 4).
      if (typeof v === "string") return BigInt([...v].length);
      throw new PVMLInterpreterError(
        `TypeError: unsupported argument type for len: ${friendlyTypeName(getPVMLType(v), variant)}`,
      );
    }

    case 5: // print/display — proper Python str() formatting per argument (see str()/repr()
      // below, case 90/91, which use this same toPythonString/pvmlBoxToCseValue machinery),
      // matching CSE's own print() (misc.ts) exactly: bool as True/False, None as None, a list
      // as [1, 2, 3] with repr-quoted string elements, not JS's own toString() conventions.
      sendOutput(args.map(a => toPythonString(pvmlBoxToCseValue(a))).join(" "));
      return undefined;

    case 10: // error
      throw new PVMLInterpreterError(`Error: ${args.map(String).join(" ")}`);

    case 14: // head
      return pairElement(args, "head", 0, variant);

    case 16: // is_list
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("is_list() takes exactly 1 argument");
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
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("is_pair() takes exactly 1 argument");
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
      pairArray(args[0], "set_head", variant).elements[0] = args[1];
      return undefined;

    case 75: // set_tail
      if (args.length !== 2)
        throw new MissingRequiredPositionalError("set_tail() takes exactly 2 arguments");
      pairArray(args[0], "set_tail", variant).elements[1] = args[1];
      return undefined;

    case 89: // tail
      return pairElement(args, "tail", 1, variant);

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

    case 96: {
      // arity — mirrors CSE's arity() (misc.ts): for a closure, the number
      // of fixed parameters (i.e. the rest param's own index, if any — a
      // rest param, always the closure's *last* parameter here, absorbs
      // every argument from that index onward, matching CSE's
      // `variadicInstance` semantics); for a primitive, its registered
      // minimum argument count (see PRIMITIVE_MIN_ARGS above).
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("arity() takes exactly 1 argument");
      const func = args[0];
      if (isPVMLObject(func) && func.type === "closure") {
        const numFixedParams = func.ir.hasRestParam ? func.ir.numArgs - 1 : func.ir.numArgs;
        return BigInt(numFixedParams);
      }
      if (isPVMLObject(func) && func.type === "primitive") {
        return BigInt(PRIMITIVE_MIN_ARGS.get(func.primitiveIndex) ?? 0);
      }
      throw new PVMLInterpreterError(
        `TypeError: unsupported argument type for arity: ${friendlyTypeName(getPVMLType(func), variant)}`,
      );
    }

    case 97: // real — the real part of a complex number, as a float. Matches
      // CSE's real() (misc.ts): requires a genuine complex argument.
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("real() takes exactly 1 argument");
      if (!(args[0] instanceof PyComplexNumber))
        throw new PVMLInterpreterError(
          `TypeError: unsupported argument type for real: ${friendlyTypeName(getPVMLType(args[0]), variant)}`,
        );
      return args[0].real;

    case 98: // imag — see real() above.
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("imag() takes exactly 1 argument");
      if (!(args[0] instanceof PyComplexNumber))
        throw new PVMLInterpreterError(
          `TypeError: unsupported argument type for imag: ${friendlyTypeName(getPVMLType(args[0]), variant)}`,
        );
      return args[0].imag;

    case 99: {
      // complex() — the constructor form (as distinct from the `a+bj`
      // literal syntax, compiled via LGCC — see PVMLCompiler's
      // visitComplexExpr). Matches CSE's complex() (misc.ts):
      //   - complex(): 0j.
      //   - complex(x): x coerced to complex — int/float/bool/complex
      //     unchanged in kind, or a string parsed the same way a `a+bj`
      //     literal's own text would be (PyComplexNumber.fromString, shared
      //     with CSE — see cse-interop.ts's own use of it).
      //   - complex(real, imag): real + imag*i, neither argument a string.
      if (args.length === 0) return new PyComplexNumber(0, 0);
      if (args.length === 1) {
        const [x] = args;
        if (typeof x === "string") {
          try {
            return PyComplexNumber.fromString(x);
          } catch {
            throw new ValueError(`ValueError: complex() arg is a malformed string`);
          }
        }
        const value = toPyComplexOperand(x);
        if (!value)
          throw new PVMLInterpreterError(
            `TypeError: unsupported argument type for complex: ${friendlyTypeName(getPVMLType(x), variant)}`,
          );
        return value;
      }
      if (args.length !== 2)
        throw new MissingRequiredPositionalError("complex() takes at most 2 arguments");
      const realPart = toPyComplexOperand(args[0]);
      const imagPart = toPyComplexOperand(args[1]);
      if (!realPart || !imagPart) {
        const bad = !realPart ? args[0] : args[1];
        throw new PVMLInterpreterError(
          `TypeError: unsupported argument type for complex: ${friendlyTypeName(getPVMLType(bad), variant)}`,
        );
      }
      return realPart.add(imagPart.mul(new PyComplexNumber(0, 1)));
    }

    case 100: {
      // _concat_arrays — compiler-internal only, never resolvable by name
      // from Python source (no PRIMITIVE_FUNCTIONS entry): PVMLCompiler's
      // visitCallExpr emits a direct CALLP to this index when flattening a
      // call with a spread argument (`f(*xs)`) into one runtime args array
      // for CALLA/CALLTA — see opcodes.ts's CALLA doc comment. Each argument
      // here is already a PVMLArray (a non-spread argument is compiled as a
      // fresh 1-element array; a spread argument's value is used directly),
      // so this just needs to flatten them into one.
      return { type: "array", elements: args.flatMap(a => (a as PVMLArray).elements) };
    }

    case 101: {
      // parse — reuses CSE's own transform() (src/stdlib/parser.ts) to build
      // the parse-tree value, converting only the final result to a PVML
      // value (cse-interop.ts's cseValueToPvmlBox) rather than re-deriving
      // Python's ~200-line AST-to-parse-tree conversion. Matches CSE's own
      // ParserBuiltins.parse (parser.ts) exactly, minus the Context coupling.
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("parse() takes exactly 1 argument");
      const [source] = args;
      if (typeof source !== "string")
        throw new PVMLInterpreterError(
          `TypeError: unsupported argument type for parse: ${friendlyTypeName(getPVMLType(source), variant)}`,
        );
      const ast = parsePython(source + "\n");
      return cseValueToPvmlBox(transform(ast, new Set()));
    }

    case 102: {
      // tokenize — wraps the shared pythonLexer directly (no CSE Value
      // coupling to convert away at all, unlike parse() above).
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("tokenize() takes exactly 1 argument");
      const [source] = args;
      if (typeof source !== "string")
        throw new PVMLInterpreterError(
          `TypeError: unsupported argument type for tokenize: ${friendlyTypeName(getPVMLType(source), variant)}`,
        );
      pythonLexer.reset(source);
      const tokens: PVMLBoxType[] = [];
      let tok;
      while ((tok = pythonLexer.next())) {
        tokens.push(tok.value);
      }
      return vectorToPvmlList(tokens);
    }

    case 103: {
      // apply_in_underlying_python(func, args_list) — walks args_list (a
      // pair-chain, same shape parser.ts:319-322 walks for CSE) into a flat
      // array, then invokes func synchronously via PVMLInterpreter's
      // invokeValue (see its doc comment) — no async/Promise needed here,
      // unlike CSE's version, since this interpreter has no resumable
      // step-machine to work around.
      if (args.length !== 2)
        throw new MissingRequiredPositionalError(
          "apply_in_underlying_python() takes exactly 2 arguments",
        );
      const [func, argsList] = args;
      const argArray: PVMLBoxType[] = [];
      let current: PVMLBoxType = argsList;
      while (isPVMLObject(current) && current.type === "array" && current.elements.length === 2) {
        argArray.push(current.elements[0]);
        current = current.elements[1];
      }
      return invokeValue(func, argArray);
    }

    case 127: {
      // print_llist: box-and-pointer text, matching linked-list.ts's _print_llist on the CSE side.
      // Plain uncached recursion -- no memoization keyed by value/object identity -- so it can't
      // suffer js-slang's display_list sharing bug (source-academy/js-slang#1124): the same pair
      // object reached via two different paths is re-derived fresh each time, not looked up from a
      // stale cached classification.
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("print_llist() takes exactly 1 argument");
      sendOutput(printLlistText(args[0]));
      return undefined;
    }

    case 76: {
      // stream — mirrors CSE's stream() (stdlib/stream.ts): `stream()`
      // (no args) is the empty stream (None); `stream(a, b, c, ...)` is
      // `pair(a, <continuation>)`, where calling the continuation with zero
      // arguments recurses into `stream(b, c, ...)`. Rather than
      // synthesizing a genuinely new closure at runtime (which, unlike
      // native Pynter's C continuations, this TS interpreter — and real
      // Pynter's own bytecode-index-based closures — can't do), the
      // continuation is represented as this same primitive (index 76) with
      // the remaining args pre-bound via PVMLPrimitive's `boundArgs` field;
      // see PVMLInterpreter.dispatchCall, which prepends `boundArgs` before
      // re-entering this same case.
      if (args.length === 0) return null;
      const [head, ...rest] = args;
      return {
        type: "array",
        elements: [head, { type: "primitive", primitiveIndex: 76, boundArgs: rest }],
      };
    }

    case 30: {
      // range
      if (args.length < 1 || args.length > 3)
        throw new MissingRequiredPositionalError(
          `range() takes 1 to 3 arguments (${args.length} given)`,
        );
      const [a, b, c] = assertIntArgs(args, "range", variant);
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
      // Math.hypot survives components whose squares overflow/underflow (see #284).
      if (x instanceof PyComplexNumber) return Math.hypot(x.real, x.imag);
      throw new PVMLInterpreterError(
        `TypeError: unsupported argument type for abs: ${friendlyTypeName(getPVMLType(x), variant)}`,
      );
    }
    case 33: // math_acos
      return unaryMath(args, "math_acos", Math.acos, variant, x => x >= -1 && x <= 1);
    case 34: // math_acosh
      return unaryMath(args, "math_acosh", Math.acosh, variant, x => x >= 1);
    case 35: // math_asin
      return unaryMath(args, "math_asin", Math.asin, variant, x => x >= -1 && x <= 1);
    case 36: // math_asinh
      return unaryMath(args, "math_asinh", Math.asinh, variant);
    case 37: // math_atan
      return unaryMath(args, "math_atan", Math.atan, variant);
    case 38: // math_atan2
      return binaryMath(args, "math_atan2", Math.atan2, variant);
    case 39: // math_atanh
      return unaryMath(args, "math_atanh", Math.atanh, variant, x => x > -1 && x < 1);
    case 40: // math_cbrt
      return unaryMath(args, "math_cbrt", Math.cbrt, variant);
    case 41: // math_ceil — returns int (bigint), matching CSE's math_ceil; see unaryMathToInt.
      return unaryMathToInt(args, "math_ceil", Math.ceil, variant);
    case 43: // math_cos
      return unaryMath(args, "math_cos", Math.cos, variant);
    case 44: // math_cosh
      return unaryMath(args, "math_cosh", Math.cosh, variant);
    case 45: // math_exp
      return unaryMath(args, "math_exp", Math.exp, variant);
    case 46: // math_expm1
      return unaryMath(args, "math_expm1", Math.expm1, variant);
    case 47: // math_floor — returns int (bigint); see unaryMathToInt.
      return unaryMathToInt(args, "math_floor", Math.floor, variant);
    case 51: {
      // math_log(x, base=None) -- the only math_* function with an optional
      // second argument (mirrors CSE's own math_log in src/stdlib/math.ts),
      // so it can't go through unaryMath's fixed one-argument shape.
      if (args.length < 1 || args.length > 2)
        throw new MissingRequiredPositionalError("math_log() takes 1 or 2 arguments");
      const [x] = assertNumericArgs([args[0]], "math_log", variant);
      if (x <= 0) throw new PVMLInterpreterError("ValueError: math domain error");
      if (args.length === 1) return Math.log(x);
      const [base] = assertNumericArgs([args[1]], "math_log", variant);
      if (base <= 0) throw new PVMLInterpreterError("ValueError: math domain error");
      return Math.log(x) / Math.log(base);
    }
    case 52: // math_log1p
      return unaryMath(args, "math_log1p", Math.log1p, variant, x => x > -1);
    case 53: // math_log2
      return unaryMath(args, "math_log2", Math.log2, variant, x => x > 0);
    case 54: // math_log10
      return unaryMath(args, "math_log10", Math.log10, variant, x => x > 0);

    case 55: {
      // max
      if (args.length < 2)
        throw new MissingRequiredPositionalError(
          `max() takes at least 2 arguments (${args.length} given)`,
        );
      return pickExtremum(args, "max", true, variant);
    }

    case 56: {
      // min
      if (args.length < 2)
        throw new MissingRequiredPositionalError(
          `min() takes at least 2 arguments (${args.length} given)`,
        );
      return pickExtremum(args, "min", false, variant);
    }

    case 57: // math_pow
      return binaryMath(args, "math_pow", Math.pow, variant);

    case 58: // random_random
      return Math.random();

    case 59: {
      // round (1-arg form, or an explicit `None` ndigits): banker's rounding
      // (round-half-to-even) to the nearest int, always returning a bigint
      // regardless of whether the input was int or float — mirrors CSE's
      // round() with no ndigits (misc.ts). Plain Math.round() would be wrong
      // here twice over: it rounds .5 away from zero instead of to even, and
      // it returns a float instead of Python's int result.
      if (args.length !== 1 && args.length !== 2)
        throw new MissingRequiredPositionalError("round() takes 1 or 2 arguments");
      const [x, ndigits] = args;
      if (typeof x !== "number" && typeof x !== "bigint")
        throw new PVMLInterpreterError(
          `TypeError: unsupported argument type for round: ${friendlyTypeName(getPVMLType(x), variant)}`,
        );

      if (args.length === 1 || ndigits === null) {
        const shifted = new Intl.NumberFormat("en-US", {
          roundingMode: "halfEven",
          useGrouping: false,
          maximumFractionDigits: 0,
        } as Intl.NumberFormatOptions).format(x);
        return BigInt(shifted);
      }

      // 2-arg form: round to `ndigits` decimal places instead, preserving
      // the input's own type (float stays float, int stays int — an int
      // input with non-negative ndigits is returned completely unrounded,
      // since there's nothing after the decimal point to round away).
      // Mirrors CSE's round() (misc.ts) exactly, including its
      // negative-ndigits handling: divide by 10**-ndigits, round to a whole
      // number, multiply back — effectively rounding to a power-of-ten
      // position left of the decimal point.
      if (typeof ndigits !== "bigint")
        throw new PVMLInterpreterError(
          `TypeError: unsupported argument type for round: ${friendlyTypeName(getPVMLType(ndigits), variant)}`,
        );

      if (typeof x === "number") {
        if (ndigits >= 0n) {
          const shifted = new Intl.NumberFormat("en-US", {
            roundingMode: "halfEven",
            useGrouping: false,
            maximumFractionDigits: Number(ndigits),
          } as Intl.NumberFormatOptions).format(x);
          return Number(shifted);
        }
        const scale = 10 ** -Number(ndigits);
        const shifted = new Intl.NumberFormat("en-US", {
          roundingMode: "halfEven",
          useGrouping: false,
          maximumFractionDigits: 0,
        } as Intl.NumberFormatOptions).format(x / scale);
        return Number(shifted) * scale;
      }

      if (ndigits >= 0n) return x;
      const scale = 10n ** -ndigits;
      const shifted = new Intl.NumberFormat("en-US", {
        roundingMode: "halfEven",
        useGrouping: false,
        maximumFractionDigits: 0,
      } as Intl.NumberFormatOptions).format(Number(x) / Number(scale));
      return BigInt(shifted) * scale;
    }

    case 61: // math_sin
      return unaryMath(args, "math_sin", Math.sin, variant);
    case 62: // math_sinh
      return unaryMath(args, "math_sinh", Math.sinh, variant);
    case 63: // math_sqrt
      return unaryMath(args, "math_sqrt", Math.sqrt, variant, x => x >= 0);
    case 64: // math_tan
      return unaryMath(args, "math_tan", Math.tan, variant);
    case 65: // math_tanh
      return unaryMath(args, "math_tanh", Math.tanh, variant);
    case 66: // math_trunc — returns int (bigint); see unaryMathToInt.
      return unaryMathToInt(args, "math_trunc", Math.trunc, variant);

    case 104: // math_degrees
      return unaryMath(args, "math_degrees", x => (x * 180) / Math.PI, variant);

    case 105: // math_erf
      return unaryMath(args, "math_erf", x => erf(x), variant);

    case 106: // math_erfc
      return unaryMath(args, "math_erfc", x => 1 - erf(x), variant);

    case 107: {
      // math_comb(n, k) — binomial coefficient, arbitrary precision.
      if (args.length !== 2)
        throw new MissingRequiredPositionalError("math_comb() takes exactly 2 arguments");
      const [n, k] = assertIntArgs(args, "math_comb", variant);
      if (n < 0n || k < 0n)
        throw new PVMLInterpreterError("ValueError: math_comb() not defined for negative values");
      if (k > n) return 0n;
      let result = 1n;
      const kk = k > n - k ? n - k : k;
      for (let i = 0n; i < kk; i++) {
        result = (result * (n - i)) / (i + 1n);
      }
      return result;
    }

    case 108: {
      // math_factorial(n)
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("math_factorial() takes exactly 1 argument");
      const [n] = assertIntArgs(args, "math_factorial", variant);
      if (n < 0n)
        throw new PVMLInterpreterError(
          "ValueError: math_factorial() not defined for negative values",
        );
      let result = 1n;
      for (let i = 1n; i <= n; i++) result *= i;
      return result;
    }

    case 109: {
      // math_gcd(*ints) — variadic.
      if (args.length === 0) return 0n;
      const values = assertIntArgs(args, "math_gcd", variant).map(v => (v < 0n ? -v : v));
      if (values.every(v => v === 0n)) return 0n;
      let result = values[0];
      for (let i = 1; i < values.length; i++) {
        result = gcdOfTwo(result, values[i]);
        if (result === 1n) break;
      }
      return result;
    }

    case 110: {
      // math_isqrt(n) — integer square root, via binary search (matches
      // CSE's math_isqrt exactly).
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("math_isqrt() takes exactly 1 argument");
      const [n] = assertIntArgs(args, "math_isqrt", variant);
      if (n < 0n)
        throw new PVMLInterpreterError("ValueError: math_isqrt() not defined for negative values");
      if (n < 2n) return n;
      let low = 1n;
      let high = n;
      while (low < high) {
        const mid = (low + high + 1n) >> 1n;
        if (mid * mid <= n) low = mid;
        else high = mid - 1n;
      }
      return low;
    }

    case 111: {
      // math_lcm(*ints) — variadic.
      if (args.length === 0) return 1n;
      const values = assertIntArgs(args, "math_lcm", variant).map(v => (v < 0n ? -v : v));
      if (values.some(v => v === 0n)) return 0n;
      let result = values[0];
      for (let i = 1; i < values.length; i++) {
        const g = gcdOfTwo(result, values[i]);
        result = (result / g) * values[i];
        if (result === 0n) break;
      }
      return result;
    }

    case 112: {
      // math_perm(n, k=n) — k defaults to n (falls back to factorial(n)).
      if (args.length < 1 || args.length > 2)
        throw new MissingRequiredPositionalError(
          `math_perm() takes 1 to 2 arguments (${args.length} given)`,
        );
      const [n] = assertIntArgs([args[0]], "math_perm", variant);
      const k =
        args.length === 2 && args[1] !== null
          ? assertIntArgs([args[1]], "math_perm", variant)[0]
          : n;
      if (n < 0n || k < 0n)
        throw new PVMLInterpreterError("ValueError: math_perm() not defined for negative values");
      if (k > n) return 0n;
      let result = 1n;
      for (let i = 0n; i < k; i++) result *= n - i;
      return result;
    }

    case 113: {
      // math_fabs — always a float, even for an int argument (unlike abs()).
      if (args.length !== 1)
        throw new MissingRequiredPositionalError("math_fabs() takes exactly 1 argument");
      const [x] = assertNumericArgs(args, "math_fabs", variant);
      return Math.abs(x);
    }

    case 114: // math_fma(x, y, z) — fused multiply-add.
      return ternaryMath(
        args,
        "math_fma",
        (x, y, z) => {
          if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) return NaN;
          if (x === 0 && !Number.isFinite(y) && Number.isNaN(z)) return NaN;
          if (y === 0 && !Number.isFinite(x) && Number.isNaN(z)) return NaN;
          return fusedMultiplyAdd(x, y, z);
        },
        variant,
      );

    case 115: // math_fmod
      return binaryMath(
        args,
        "math_fmod",
        (x, y) => {
          if (y === 0) throw new ZeroDivisionError("math_fmod");
          return x % y;
        },
        variant,
      );

    case 116: // math_remainder — IEEE 754 remainder (round-half-to-even quotient). Matches
      // real Python's math.remainder special cases (verified against CPython): y == 0 or x
      // infinite raises (a ValueError there, not a ZeroDivisionError -- remainder(x, 0) isn't
      // really "dividing by zero" in the IEEE 754 sense), y infinite with finite x returns x
      // unchanged (mod-by-infinity never reduces it), and NaN propagates like any other
      // arithmetic NaN. Only the finite/finite case falls through to the round-half-to-even
      // formula below.
      return binaryMath(
        args,
        "math_remainder",
        (x, y) => {
          if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
          if (y === 0 || !Number.isFinite(x)) {
            throw new PVMLInterpreterError("ValueError: math domain error");
          }
          if (!Number.isFinite(y)) return x;
          const n = roundToEven(x / y);
          return x - n * y;
        },
        variant,
      );

    case 117: // math_copysign
      return binaryMath(
        args,
        "math_copysign",
        (x, y) => {
          const absVal = Math.abs(x);
          return y < 0 || Object.is(y, -0) ? -absVal : absVal;
        },
        variant,
      );

    case 118: // math_isfinite
      return unaryMathBool(args, "math_isfinite", Number.isFinite, variant);

    case 119: // math_isinf
      return unaryMathBool(args, "math_isinf", x => x === Infinity || x === -Infinity, variant);

    case 120: // math_isnan
      return unaryMathBool(args, "math_isnan", Number.isNaN, variant);

    case 121: {
      // math_ldexp(x, i) — x * 2**i; i must be an int. Verified against CPython: x === 0 is a
      // fast path returning 0 unchanged even for a huge i (avoiding 0 * Infinity -> NaN once
      // Math.pow(2, Number(i)) itself overflows), an already-infinite/NaN x passes through
      // unchanged (that's not an overflow, just propagating the input), and only a genuine
      // finite-x-becomes-infinite result raises OverflowError.
      if (args.length !== 2)
        throw new MissingRequiredPositionalError("math_ldexp() takes exactly 2 arguments");
      const [x] = assertNumericArgs([args[0]], "math_ldexp", variant);
      const [i] = assertIntArgs([args[1]], "math_ldexp", variant);
      if (x === 0) return x;
      const result = x * Math.pow(2, Number(i));
      if (!Number.isFinite(result) && Number.isFinite(x)) {
        throw new PVMLInterpreterError("OverflowError: math range error");
      }
      return result;
    }

    case 122: // math_exp2
      return unaryMath(args, "math_exp2", x => Math.pow(2, x), variant);

    case 123: // math_gamma
      return unaryMath(args, "math_gamma", x => gamma(x), variant);

    case 124: // math_lgamma
      return unaryMath(args, "math_lgamma", x => lgamma(x), variant);

    case 125: // math_radians
      return unaryMath(args, "math_radians", x => (x * Math.PI) / 180, variant);

    case 126: // time_time — always a float, matching CSE's time_time (misc.ts). Python's
      // time.time() is documented as seconds since the epoch, not milliseconds — divide
      // Date.now()'s milliseconds down to match.
      return Date.now() / 1000;

    case 128: // math_nextafter — see PRIMITIVE_FUNCTIONS' doc comment: an unimplemented
      // stub on the CSE side too.
      throw new PVMLInterpreterError("math_nextafter not implemented");

    case 129: // math_ulp — see math_nextafter above.
      throw new PVMLInterpreterError("math_ulp not implemented");

    case 130: // input — see PRIMITIVE_FUNCTIONS' doc comment: a real CSE feature this
      // synchronous interpreter has no async-stdin equivalent of.
      throw new PVMLInterpreterError("input() is not supported by the PVML-in-browser pathway");

    default:
      throw new PVMLInterpreterError(`Unknown primitive function index: ${primitiveIndex}`);
  }
}
