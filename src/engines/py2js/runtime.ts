/**
 * py2js engine — runtime library.
 *
 * Native (unboxed) JS value model:
 *   int      -> bigint
 *   float    -> number
 *   bool     -> boolean
 *   str      -> string
 *   None     -> null
 *   complex  -> PyComplexNumber (src/types)
 *   list     -> PyList, a plain mutable JS array of PyValues. A chapter-2
 *               pair (built by pair()/llist()) is just a 2-element PyList —
 *               there is no separate pair type, matching the CSE machine,
 *               which represents both a pair and an arbitrary-length list as
 *               the same flat `{type:"list", value: Value[]}`
 *               (src/engines/cse/stash.ts). "Is this a pair" is therefore a
 *               structural question (length === 2), not a type-level one —
 *               is_list/list_length/subscripting/pyTypeName can't tell a
 *               pair from a 2-element list either, on either engine, which
 *               is the correct, CSE-matching answer, not a gap.
 *   function -> JS function carrying pyName/pyArity metadata
 *   opaque   -> PyOpaque (a module value with no py2js-native representation
 *               — e.g. a sound or image handle — held and passed around but
 *               not otherwise inspectable; see moduleInterop.ts)
 *
 * User values stay unboxed so V8 can JIT the compiled program; the Python
 * operator semantics live in the helpers below, which mirror
 * evaluateBinaryExpression / evaluateUnaryExpression in
 * src/engines/cse/operators.ts (the reference implementation) — same dispatch
 * order, same per-chapter typing rules. The operator typing rules themselves
 * are specified in docs/specs/python_typing_front.tex, python_typing_middle_
 * {12,34}.tex and python_typing_back.tex; conformance against them is pinned
 * by src/tests/operator-conformance-py2js.test.ts, which sweeps the full
 * operator × type × type cross product against the CSE machine.
 *
 * Error-message type names: CSE's friendlyTypeName (engines/cse/types.ts)
 * reports a list-shaped value as "pair" at chapters 1-2 and "list" at
 * chapter 3+ — the chapter, not the value, decides the word, since chapters
 * 1-2 have no list-literal syntax at all (so any array-shaped value there
 * can only have come from pair()/linked-list construction, unambiguously),
 * while at chapter 3+ both syntaxes coexist and "list" is the reasonable
 * default. pyTypeName mirrors this via an explicit `sayPair` parameter
 * threaded from whichever `restrict`/`universalEquality`-style chapter
 * signal is already in scope at each call site — chapter 1 never actually
 * reaches an array-shaped value, so the parameter is simply inert there.
 *
 * Proper tail calls: compiled functions return a TailCall marker from return
 * statements in tail position; `call` runs the trampoline. In dual mode every
 * user function carries a second, async body (def2) used on the program's
 * async spine (acall), while TS modules call back into Python synchronously
 * through callSync — see compiler.ts's mode documentation.
 */
import { DataType, TypedValue } from "@sourceacademy/conductor/types";
import { numericCompare, pythonMod } from "../cse/utils";
import type { Value } from "../cse/stash";
import { toPythonFloat, toPythonString } from "../../stdlib/utils";
import { PyComplexNumber } from "../../types";
import { stringify } from "../../utils/stringify";

export type PyValue =
  | bigint
  | number
  | boolean
  | string
  | null
  | PyComplexNumber
  | PyList
  | PyOpaque
  | PyFunction;

/**
 * A Python list — chapter 2's pair (built by pair()/llist()) and chapter 3's
 * arbitrary-length list literal alike: a plain mutable JS array of PyValues.
 * One representation for both, matching the CSE machine's own internal
 * `{type:"list", value: Value[]}` (src/engines/cse/stash.ts), which has no
 * separate pair type either. Array.isArray is a free, zero-cost discriminant
 * since nothing else in PyValue is a JS array. A 2-element PyList is what
 * pair()/llist()/set_head/set_tail/subscripting treat as a cons cell; that's
 * a structural fact about its length, not a tag on the value — the same
 * duality CSE itself has (see the file header).
 */
export type PyList = PyValue[];

/**
 * An imported module value with no py2js-native representation (conductor's
 * DataType.OPAQUE) — held and passed around opaquely, matching the CSE
 * machine's "opaque" Value type. See moduleInterop.ts's moduleToPython.
 */
export class PyOpaque {
  constructor(public readonly typed: TypedValue<DataType.OPAQUE>) {}
}

export interface PyFunction {
  (...args: PyValue[]): PyValue | TailCall;
  pyName: string;
  /** Number of parameters; -1 means variadic (builtins like print). */
  pyArity: number;
  pyBuiltin?: boolean;
  /**
   * For bridged stdlib builtins: the CSE-side minArgs, reported by the
   * native arity() builtin so both engines answer arity questions
   * identically (bridged functions run with pyArity -1, leaving argument
   * count validation to the stdlib's own @Validate wrappers).
   */
  pyMinArgs?: number;
  /**
   * Dual compilation: the async twin of this (sync) body, sharing the same
   * closure environment. Present on every user function compiled in dual
   * mode; absent on builtins (which are plain sync JS, or return a Promise
   * that acall awaits).
   */
  asyncBody?: (...args: PyValue[]) => Promise<PyValue | TailCall> | PyValue | TailCall;
  /**
   * Module functions that require an asynchronous frontend round-trip
   * (channel request/response). Callable only on the async path; the sync
   * trampoline rejects them so a module-driven synchronous callback fails
   * loudly instead of receiving an unawaited Promise.
   */
  asyncOnly?: boolean;
  /**
   * Set on a PyFunction created by moduleToPython's DataType.CLOSURE case:
   * the original module closure this function stands in for. Lets
   * pythonToModule hand a module closure back to a module (the same one or
   * a different one, e.g. a Sound's wave function created by sine_sound and
   * later passed to play) by returning this identifier unchanged, instead of
   * wrapping it in a *new* closure whose body assumes a genuine Python
   * function it can rt.callSync — which this isn't, and would throw
   * "needs a frontend round-trip" the moment the module tried to sample it.
   * Mirrors the CSE converter's identical `.id` pass-through in
   * src/engines/cse/modules.ts.
   */
  moduleClosure?: TypedValue<DataType.CLOSURE>;
}

export interface TailCall {
  __tail: true;
  f: PyValue;
  args: PyValue[];
}

/**
 * Runtime error raised by compiled py2js code. `pyKind` names the Python
 * error type (UnsupportedOperandTypeError, ZeroDivisionError, TypeError, …),
 * matching the CSE machine's error-class names so callers can compare
 * behavior across engines. Source locations are not attached yet — see the
 * engine README's future-work notes.
 */
export class Py2JsRuntimeError extends Error {
  constructor(
    public readonly pyKind: string,
    message: string,
  ) {
    super(message);
    this.name = pyKind;
  }
}

/**
 * `sayPair` mirrors CSE's friendlyTypeName(name, variant): true at chapters
 * 1-2 renders a list-shaped value as "pair" instead of "list" — see the file
 * header. Every call site threads through whichever `restrict`/
 * `universalEquality`-style chapter signal it already has in scope.
 */
export function pyTypeName(v: PyValue, sayPair = false): string {
  switch (typeof v) {
    case "bigint":
      return "int";
    case "number":
      return "float";
    case "boolean":
      return "bool";
    case "string":
      return "str";
    case "function":
      return "function";
    case "object":
      if (v === null) return "NoneType";
      if (Array.isArray(v)) return sayPair ? "pair" : "list";
      if (v instanceof PyOpaque) return "opaque";
      return "complex";
    default:
      return "NoneType";
  }
}

function unsupported(op: string, l: PyValue, r?: PyValue, sayPair = false): never {
  const rhs = r === undefined ? "" : ` and '${pyTypeName(r, sayPair)}'`;
  throw new Py2JsRuntimeError(
    "UnsupportedOperandTypeError",
    `unsupported operand type(s) for ${op}: '${pyTypeName(l, sayPair)}'${rhs}`,
  );
}

/**
 * Converts a PyValue into the minimal CSE Value shape src/utils/stringify.ts
 * needs, so pyStr's pair rendering (bracket notation, and recursively for
 * anything nested inside) is pixel-identical to the CSE machine's own
 * structured print — by reusing the actual algorithm, not a second
 * hand-written copy that could quietly drift. Only reached for pairs (and
 * whatever they contain); every other pyStr case keeps its own fast path.
 */
function toDisplayValue(v: PyValue): Value {
  if (v === null) return { type: "none" };
  switch (typeof v) {
    case "bigint":
      return { type: "bigint", value: v };
    case "number":
      return { type: "number", value: v };
    case "boolean":
      return { type: "bool", value: v };
    case "string":
      return { type: "string", value: v };
    case "function":
      // stringify's convert() only reads `.name` for these two Value kinds —
      // the rest of BuiltinValue/FunctionValue's shape is irrelevant here.
      return (
        v.pyBuiltin ? { type: "builtin", name: v.pyName } : { type: "function", name: v.pyName }
      ) as Value;
    default:
      if (Array.isArray(v)) {
        return { type: "list", value: v.map(toDisplayValue) };
      }
      // stringify()'s convert() has no dedicated "opaque" case — it falls to
      // the generic `<${type} object>` fallback, matching pyStr's own
      // "<opaque object>" rendering, so this is just as accurate as a
      // dedicated case would be.
      if (v instanceof PyOpaque) return { type: "opaque", value: v.typed };
      return { type: "complex", value: v };
  }
}

export function pyStr(v: PyValue): string {
  switch (typeof v) {
    case "bigint":
      return v.toString();
    case "number":
      return toPythonFloat(v);
    case "boolean":
      return v ? "True" : "False";
    case "string":
      return v;
    case "function":
      return v.pyBuiltin ? `<built-in function ${v.pyName}>` : `<function ${v.pyName}>`;
    case "object":
      if (v === null) return "None";
      if (Array.isArray(v)) return stringify(toDisplayValue(v));
      // Matches the CSE machine's toPythonString default case (stdlib/
      // utils.ts) for its "opaque" Value type.
      return v instanceof PyOpaque ? "<opaque object>" : v.toString();
    default:
      return "None";
  }
}

/** A 2-element PyList — the shape pair()/llist()/set_head/set_tail treat as
 * a cons cell. Structural, not a type tag (see the file header): a genuine
 * N-element (N≠2) literal list is never mistaken for one, and neither is a
 * coincidentally-2-element literal list mistaken for anything other than
 * what it structurally is — matching CSE's own isPair (src/stdlib/
 * linked-list.ts), which makes exactly the same length check. */
export const isPairShaped = (v: PyValue): v is [PyValue, PyValue] =>
  Array.isArray(v) && v.length === 2;

/** Whether `v` is a proper linked list: a chain of 2-element cons cells
 * terminated by None, as opposed to an arbitrary pair or an N-element (N≠2)
 * literal list — mirrors isProperList in src/stdlib/linked-list.ts (the
 * distinction print_llist uses below). Iterative rather than (tail-)
 * recursive: JS engines don't guarantee TCO, so a long list would otherwise
 * risk a stack overflow — the same failure mode printLlist's own outer
 * list-walking `while` loop below already avoids. */
function isProperList(v: PyValue): boolean {
  let current = v;
  while (isPairShaped(current)) {
    current = current[1];
  }
  return current === null;
}

/**
 * print_llist's box-and-pointer rendering — ports the CSE machine's
 * _print_llist/_is_llist (src/stdlib/linked-list.ts): a proper list renders
 * as `llist(a, b, c)`, any other 2-element cons cell as bracket notation
 * `[a, b]` (recursively), and anything else (including an N-element, N≠2,
 * literal list) via toPythonString's repr mode (reused directly, via
 * toDisplayValue, rather than re-implementing string escaping) — same as
 * CSE's `toPythonString(value, true)` leaf case.
 */
function printLlist(v: PyValue): string {
  if (!isProperList(v)) {
    if (!isPairShaped(v)) return toPythonString(toDisplayValue(v), true);
    return `[${printLlist(v[0])}, ${printLlist(v[1])}]`;
  }
  let s = "llist(";
  let current: PyValue = v;
  while (isPairShaped(current)) {
    s += printLlist(current[0]) + ", ";
    current = current[1];
  }
  if (s.endsWith(", ")) s = s.slice(0, -2);
  return s + ")";
}

const isNum = (v: PyValue): v is bigint | number => typeof v === "bigint" || typeof v === "number";

const isComplex = (v: PyValue): v is PyComplexNumber => v instanceof PyComplexNumber;

/** int, float or complex — the operands the complex arithmetic branch coerces
 * (mirrors isCoercedComplex in src/engines/cse/utils.ts). */
const isCoercibleToComplex = (v: PyValue): v is bigint | number | PyComplexNumber =>
  isNum(v) || isComplex(v);

function toComplex(v: bigint | number | PyComplexNumber): PyComplexNumber {
  if (isComplex(v)) return v;
  return typeof v === "bigint" ? PyComplexNumber.fromBigInt(v) : PyComplexNumber.fromNumber(v);
}

/** A float NaN, or a complex with a NaN component — unequal to everything,
 * as in CPython (mirrors isNaNValue in src/engines/cse/operators.ts). */
function isNaNValue(v: PyValue): boolean {
  if (typeof v === "number") return Number.isNaN(v);
  if (isComplex(v)) return Number.isNaN(v.real) || Number.isNaN(v.imag);
  return false;
}

/**
 * Chapter 1 `==`/`!=`: structural equality over any operand pair except bool
 * and function, which are excluded entirely (docs/specs/
 * python_typing_middle_12.tex; excludedFromChapter12Equality in the CSE
 * operators). NaN is unequal to everything; numbers compare across
 * int/float/complex; None == None; strings by value; remaining different
 * types are simply unequal.
 */
/**
 * `==`/`!=`. `restrict` is true at chapters 1-2 (bool/function excluded
 * entirely — docs/specs/python_typing_middle_12.tex) and false at chapter 3+,
 * where equality is total over any operand pair — mirrors
 * evaluateBinaryExpression/handleExpandedEquality's `restrictChapter12`
 * threading in src/engines/cse/operators.ts, re-checked at every level of
 * list/pair recursion, not just the top level.
 */
function pyEquals(l: PyValue, r: PyValue, restrict: boolean): boolean {
  if (restrict && (typeof l === "boolean" || typeof l === "function")) {
    unsupported("==", l, r, restrict);
  }
  if (restrict && (typeof r === "boolean" || typeof r === "function")) {
    unsupported("==", l, r, restrict);
  }
  // At chapter 3+, booleans compare as the ints they are (True == 1, False ==
  // 0.0) — mirrors asIntIfBool's use in CSE's structuralEquals. At chapter
  // 1-2 this is unreachable: the exclusion above already rejected any bool
  // operand.
  if (!restrict) {
    if (typeof l === "boolean") l = l ? 1n : 0n;
    if (typeof r === "boolean") r = r ? 1n : 0n;
  }
  if (isNaNValue(l) || isNaNValue(r)) return false;
  if (isComplex(l) || isComplex(r)) {
    if (!isCoercibleToComplex(l) || !isCoercibleToComplex(r)) return false;
    return toComplex(l).equals(toComplex(r));
  }
  if (isNum(l) && isNum(r)) return numericCompare(l, r) === 0;
  if (l === null && r === null) return true;
  if (Array.isArray(l) && Array.isArray(r)) {
    // Identity shortcut first (mirrors CSE's structuralEquals — also lets a
    // self-referential pair/list compare equal to itself without recursing
    // forever, and chapter 3's pair mutators/list-assign can build exactly
    // such a cycle). One representation for pairs and lists alike (see the
    // file header), so this single branch is also what makes
    // `pair(1, 2) == [1, 2]` compare True, matching CSE — there's no
    // separate cross-type case to write, because there's no separate type.
    if (l === r) return true;
    if (l.length !== r.length) return false;
    return l.every((el, i) => pyEquals(el, r[i], restrict));
  }
  return l === r; // strings by value; mixed types (incl. pair vs non-pair) are simply unequal
}

/**
 * `is`/`is not` (chapter 3+ only — chapter 1-2 reject the operator entirely
 * at resolve time via NoIsOperatorValidator; this is an independent runtime
 * backstop, mirroring the CSE machine's own variant gate on top of its own
 * validator). Mirrors pyIdentical in src/engines/cse/operators.ts, which
 * exists mostly to compare CSE's *boxed* Values by their underlying
 * primitive; py2js's values are already unboxed, so plain `===` already *is*
 * that comparison for every case except complex numbers (each occurrence is
 * a freshly-allocated PyComplexNumber object, so `===` would never consider
 * two equal-valued complex numbers identical — CSE's pyIdentical special-
 * cases this the same way).
 */
function pyIdentical(l: PyValue, r: PyValue): boolean {
  if (isComplex(l) && isComplex(r)) return l.equals(r);
  return l === r;
}

/**
 * Ordering comparisons: int/float × int/float and str × str at chapter 1-2
 * (bool and complex operands are errors — python_typing_middle_12.tex,
 * python_typing_back.tex); at chapter 3+, bool also participates as the int
 * it is (`True < 2` is `True` — python_typing_middle_34.tex, mirroring
 * asIntIfBool's use in evaluateBinaryExpression). NaN is unordered: every
 * comparison is False.
 */
function pyOrder(op: string, l: PyValue, r: PyValue, universal: boolean): boolean {
  // Gated on both operands already being bool-or-numeric — as in CSE — so an
  // unsupported comparison against some other type (e.g. `True < 'abc'`)
  // still reports 'bool', not 'int', in its error message below.
  const isOrderable = (v: PyValue): boolean => typeof v === "boolean" || isNum(v);
  if (universal && isOrderable(l) && isOrderable(r)) {
    if (typeof l === "boolean") l = l ? 1n : 0n;
    if (typeof r === "boolean") r = r ? 1n : 0n;
  }
  if (typeof l === "string" && typeof r === "string") {
    switch (op) {
      case "<":
        return l < r;
      case "<=":
        return l <= r;
      case ">":
        return l > r;
      default:
        return l >= r;
    }
  }
  if (!isNum(l) || !isNum(r)) unsupported(op, l, r, !universal);
  if ((typeof l === "number" && Number.isNaN(l)) || (typeof r === "number" && Number.isNaN(r))) {
    return false;
  }
  const c = numericCompare(l, r);
  switch (op) {
    case "<":
      return c < 0;
    case "<=":
      return c <= 0;
    case ">":
      return c > 0;
    default:
      return c >= 0;
  }
}

function complexBinop(op: string, l: PyValue, r: PyValue, sayPair: boolean): PyComplexNumber {
  if (!isCoercibleToComplex(l) || !isCoercibleToComplex(r)) unsupported(op, l, r, sayPair);
  const a = toComplex(l);
  const b = toComplex(r);
  switch (op) {
    case "+":
      return a.add(b);
    case "-":
      return a.sub(b);
    case "*":
      return a.mul(b);
    case "/":
      if (b.real === 0 && b.imag === 0) {
        throw new Py2JsRuntimeError("ZeroDivisionError", "complex division by zero");
      }
      return a.divBy(b);
    case "**":
      try {
        return a.pow(b);
      } catch {
        // PyComplexNumber.pow throws a plain Error for 0 ** negative/complex
        throw new Py2JsRuntimeError(
          "ZeroDivisionError",
          "zero cannot be raised to a negative or complex power",
        );
      }
    default:
      // %, // and every ordering operator are unsupported on complex operands
      unsupported(op, l, r, sayPair);
  }
}

export class Py2JsRuntime {
  /**
   * True at chapter 3+: `==`/`!=` are total over any operand pair (instead of
   * excluding bool/function entirely), `is`/`is not` are legal, and bool
   * participates in ordering comparisons as the int it is. Defaults to the
   * chapter 1-2 (restricted) behavior so existing no-argument construction
   * sites are unaffected; index.ts passes `variant >= 3` explicitly.
   */
  constructor(public readonly universalEquality: boolean = false) {}

  output: string[] = [];

  /**
   * Called once per print() with the formatted line (no trailing newline) —
   * the conductor evaluator streams these to the frontend as they happen;
   * `output` above still accumulates regardless.
   */
  onOutput?: (line: string) => void;

  /**
   * Persistent module-level bindings for REPL-mode chunks (see compiler.ts's
   * REPL-mode doc): every top-level binding of every chunk lives here, so a
   * later chunk — and functions from earlier chunks, via gref's late lookup —
   * see the current binding, as with the CSE machine's global environment.
   * Object.create(null): plain dictionary, no prototype pollution concerns
   * with student-chosen names like "constructor".
   */
  readonly globals: Record<string, PyValue> = Object.create(null) as Record<string, PyValue>;

  /** Guarded read of a module-level binding: a name whose binding statement
   * never executed (e.g. defined only in a not-taken branch) is a NameError,
   * as in Python — undefined is not a PyValue, so the check is exact. */
  gref(name: string): PyValue {
    const v = this.globals[name];
    if (v === undefined) {
      this.nameErr(name);
    }
    return v;
  }

  /** A module-level name whose binding never executed (compiled reads guard
   * with `=== undefined`; see emitName in compiler.ts). */
  nameErr(name: string): never {
    throw new Py2JsRuntimeError("NameError", `name '${name}' is not defined`);
  }

  /** A function-local read before its assignment executed — CPython's
   * UnboundLocalError (the CSE machine raises the same; compiled reads of
   * non-parameter locals guard with `=== undefined`). */
  unboundErr(name: string): never {
    throw new Py2JsRuntimeError(
      "UnboundLocalError",
      `local variable '${name}' referenced before assignment`,
    );
  }

  /**
   * Values resolved by an async import-loading pre-pass (module loaded,
   * converted to native PyValues — see moduleInterop.ts), keyed by the bound
   * (aliased) name, for the compiled FromImport statement about to run to
   * read via importedValue. Set fresh per chunk by whatever's running it
   * (Py2JsSession.runChunk in index.ts); a chunk with no imports never
   * touches this.
   */
  private pendingImports: Record<string, PyValue> = Object.create(null) as Record<string, PyValue>;

  /** Called before running a chunk that contains FromImport statements. */
  setPendingImports(bindings: Record<string, PyValue>): void {
    this.pendingImports = bindings;
  }

  /** Reads a value the import-loading pre-pass resolved for a compiled
   * FromImport statement (see compiler.ts). Missing here is an internal
   * inconsistency (the loader and the compiler disagreeing on which names
   * this chunk imports), not a user-facing error. */
  importedValue(name: string): PyValue {
    if (!(name in this.pendingImports)) {
      throw new Py2JsRuntimeError("SystemError", `py2js: no pending import value for '${name}'`);
    }
    return this.pendingImports[name];
  }

  /** None singleton alias so compiled code can say __py.None. */
  readonly None = null;

  /** Complex literal constructor used by compiled code. */
  complex(real: number, imag: number): PyComplexNumber {
    return new PyComplexNumber(real, imag);
  }

  binop(op: string, l: PyValue, r: PyValue): PyValue {
    // Fast path: int (X) int — by far the hottest case in chapter 1 programs.
    if (typeof l === "bigint" && typeof r === "bigint") {
      switch (op) {
        case "+":
          return l + r;
        case "-":
          return l - r;
        case "*":
          return l * r;
        case "<":
          return l < r;
        case "<=":
          return l <= r;
        case ">":
          return l > r;
        case ">=":
          return l >= r;
        case "==":
          return l === r;
        case "!=":
          return l !== r;
        case "/":
          if (r === 0n) throw new Py2JsRuntimeError("ZeroDivisionError", "division by zero");
          return Number(l) / Number(r);
        case "//":
          if (r === 0n)
            throw new Py2JsRuntimeError("ZeroDivisionError", "integer division or modulo by zero");
          return (l - pythonMod(l, r)) / r;
        case "%":
          if (r === 0n)
            throw new Py2JsRuntimeError("ZeroDivisionError", "integer division or modulo by zero");
          return pythonMod(l, r);
        case "**":
          if (l === 0n && r < 0n)
            throw new Py2JsRuntimeError(
              "ZeroDivisionError",
              "0.0 cannot be raised to a negative power",
            );
          return r < 0n ? Number(l) ** Number(r) : l ** r;
      }
    }

    // Same dispatch order as evaluateBinaryExpression (cse/operators.ts):
    // equality first (it is total over the non-excluded §1 universe), then
    // ordering, then the complex branch, then None/string, then numerics.
    switch (op) {
      case "==":
        return pyEquals(l, r, !this.universalEquality);
      case "!=":
        return !pyEquals(l, r, !this.universalEquality);
      case "<":
      case "<=":
      case ">":
      case ">=":
        return pyOrder(op, l, r, this.universalEquality);
      case "is":
      case "is not":
        // NoIsOperatorValidator (the resolver) already rejects this operator
        // at chapter 1-2; universalEquality false here is an independent
        // runtime backstop, matching the CSE machine's own variant gate.
        if (!this.universalEquality) unsupported(op, l, r, !this.universalEquality);
        return (op === "is not") !== pyIdentical(l, r);
    }

    if (isComplex(l) || isComplex(r)) {
      return complexBinop(op, l, r, !this.universalEquality);
    }

    // String concatenation: str + str only.
    if (typeof l === "string" || typeof r === "string") {
      if (op === "+" && typeof l === "string" && typeof r === "string") return l + r;
      unsupported(op, l, r, !this.universalEquality);
    }

    if (!isNum(l) || !isNum(r)) unsupported(op, l, r, !this.universalEquality);

    // Mixed int/float (or float/float) arithmetic: coerce to float, as the CSE
    // machine does (with the same potential precision loss on huge ints).
    const a = Number(l);
    const b = Number(r);
    switch (op) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "*":
        return a * b;
      case "/":
        if (b === 0) throw new Py2JsRuntimeError("ZeroDivisionError", "float division by zero");
        return a / b;
      case "//":
        if (b === 0)
          throw new Py2JsRuntimeError("ZeroDivisionError", "float floor division by zero");
        return Math.floor(a / b);
      case "%":
        if (b === 0) throw new Py2JsRuntimeError("ZeroDivisionError", "float modulo");
        return pythonMod(a, b);
      case "**":
        if (a === 0 && b < 0)
          throw new Py2JsRuntimeError(
            "ZeroDivisionError",
            "0.0 cannot be raised to a negative power",
          );
        return a ** b;
      default:
        unsupported(op, l, r, !this.universalEquality);
    }
  }

  unop(op: string, v: PyValue): PyValue {
    const sayPair = !this.universalEquality;
    switch (op) {
      case "not":
        if (typeof v !== "boolean") unsupported("not", v, undefined, sayPair);
        return !v;
      case "-":
        if (typeof v === "bigint") return -v;
        if (typeof v === "number") return -v;
        if (isComplex(v)) return new PyComplexNumber(-v.real, -v.imag);
        unsupported("-", v, undefined, sayPair);
        break;
      case "+":
        if (isNum(v) || isComplex(v)) return v;
        unsupported("+", v, undefined, sayPair);
    }
    throw new Py2JsRuntimeError("UnsupportedOperandTypeError", `bad unary operator ${op}`);
  }

  /**
   * `expr[index]` (chapter 3+): mirrors the CSE machine's LIST_ACCESS
   * instruction — a list or string subject, an int index, bounds-checked;
   * negative indices are not supported (CSE's own LIST_ACCESS has no
   * negative-index handling either, unlike list-assignment below).
   */
  listAccess(list: PyValue, index: PyValue): PyValue {
    const sayPair = !this.universalEquality;
    if (typeof list !== "string" && !Array.isArray(list)) {
      throw new Py2JsRuntimeError(
        "TypeError",
        `'${pyTypeName(list, sayPair)}' object is not subscriptable`,
      );
    }
    if (typeof index !== "bigint") {
      throw new Py2JsRuntimeError(
        "TypeError",
        `list indices must be integers, not '${pyTypeName(index, sayPair)}'`,
      );
    }
    const idx = Number(index);
    if (typeof list === "string") {
      // Spread rather than raw .length/[idx]: matches CSE's code-point-based
      // indexing (correct for astral characters), not UTF-16 code units.
      const chars = [...list];
      if (idx >= chars.length)
        throw new Py2JsRuntimeError("IndexError", "string index out of range");
      return chars.at(idx) ?? "";
    }
    if (idx >= list.length) throw new Py2JsRuntimeError("IndexError", "list index out of range");
    return list[idx];
  }

  /**
   * `expr[index] = value` (chapter 3+): mirrors evaluateListAssignment in
   * src/engines/cse/utils.ts, including its negative-index handling (a
   * modulo, not a true Python wraparound — kept bug-compatible with CSE
   * rather than "fixed", since conformance with the reference engine is the
   * goal here).
   */
  listAssign(list: PyValue, index: PyValue, value: PyValue): void {
    const sayPair = !this.universalEquality;
    if (!Array.isArray(list)) {
      throw new Py2JsRuntimeError(
        "TypeError",
        `'${pyTypeName(list, sayPair)}' object does not support item assignment`,
      );
    }
    if (typeof index !== "bigint") {
      throw new Py2JsRuntimeError(
        "TypeError",
        `list indices must be integers, not '${pyTypeName(index, sayPair)}'`,
      );
    }
    let idx = Number(index);
    if (idx < 0) idx = idx % list.length;
    if (idx >= list.length) {
      throw new Py2JsRuntimeError("IndexError", "list assignment index out of range");
    }
    list[idx] = value;
  }

  /**
   * Python truthiness, as the CSE machine's BRANCH instruction applies it to
   * `if` and ternary conditions (its WHILE instruction demands bool, but
   * chapter 1 has no loops). Mirrors isFalsy in cse/operators.ts.
   */
  truth(v: PyValue): boolean {
    switch (typeof v) {
      case "bigint":
        return v !== 0n;
      case "number":
        return v !== 0;
      case "boolean":
        return v;
      case "string":
        return v !== "";
      case "function":
        return true;
      case "object":
        if (v === null) return false;
        // Lists (even empty ones — CSE's isFalsy has no length-based case
        // for its "list" type, unlike real Python's `bool([])`) and opaque
        // module values are all always truthy — CSE's isFalsy default
        // treats every object other than the cases above as truthy.
        if (v instanceof PyOpaque || Array.isArray(v)) return true;
        return v.real !== 0 || v.imag !== 0;
      default:
        return false;
    }
  }

  /** Left operand of and/or must be bool (mirrors the CSE BOOL_OP instruction). */
  boolLeft(v: PyValue, op: string): boolean {
    if (typeof v !== "boolean") unsupported(op, v, undefined, !this.universalEquality);
    return v;
  }

  /**
   * `while` condition (chapter 3+): unlike `truth()`, a bare bool is
   * required — mirrors the CSE machine's WHILE instruction, which is
   * deliberately stricter here than Python's usual any-type truthiness (see
   * src/tests/loops.test.ts's "while 1:"/"while y + 1:" TypeError cases).
   */
  whileCond(v: PyValue): boolean {
    if (typeof v !== "boolean") {
      throw new Py2JsRuntimeError(
        "TypeError",
        `while condition must be bool, not '${pyTypeName(v, !this.universalEquality)}'`,
      );
    }
    return v;
  }

  /**
   * `for x in range(...)` bounds check (chapter 3+): mirrors the CSE
   * machine's FOR instruction — all three of start/end/step must be int,
   * and a zero step is a ValueError, before the desugared while-loop
   * (compiler.ts's For codegen) ever runs.
   */
  forRangeCheck(start: PyValue, end: PyValue, step: PyValue): void {
    for (const v of [start, end, step]) {
      if (typeof v !== "bigint") {
        throw new Py2JsRuntimeError(
          "TypeError",
          `'${pyTypeName(v, !this.universalEquality)}' object cannot be interpreted as an integer`,
        );
      }
    }
    if (step === 0n) {
      throw new Py2JsRuntimeError("ValueError", "range() arg 3 must not be zero");
    }
  }

  private checkCallable(f: PyValue, nArgs: number, sync: boolean): PyFunction {
    if (typeof f !== "function") {
      throw new Py2JsRuntimeError(
        "TypeError",
        `'${pyTypeName(f, !this.universalEquality)}' object is not callable`,
      );
    }
    if (f.pyArity >= 0 && f.pyArity !== nArgs) {
      throw new Py2JsRuntimeError(
        "TypeError",
        `${f.pyName}() takes ${f.pyArity} argument${f.pyArity === 1 ? "" : "s"} but ${nArgs} ${nArgs === 1 ? "was" : "were"} given`,
      );
    }
    if (sync && f.asyncOnly) {
      throw new Py2JsRuntimeError(
        "TypeError",
        `${f.pyName}() needs a frontend round-trip and cannot be called from a synchronous module callback`,
      );
    }
    return f;
  }

  /** Non-tail call: run the trampoline until a real value comes back. */
  call(f: PyValue, args: PyValue[]): PyValue {
    let result = this.checkCallable(f, args.length, true)(...args);
    while (result !== null && typeof result === "object" && (result as TailCall).__tail === true) {
      const t = result as TailCall;
      result = this.checkCallable(t.f, t.args.length, true)(...t.args);
    }
    return result === undefined ? null : (result as PyValue);
  }

  /**
   * Async twin of `call`, used by dual-mode compiled code: dispatches to a
   * user function's asyncBody (so the callee can await module round-trips)
   * and awaits every trampoline bounce. Builtins run directly; if one
   * returns a Promise (an async module function), the await unwraps it.
   */
  async acall(f: PyValue, args: PyValue[]): Promise<PyValue> {
    let fn = this.checkCallable(f, args.length, false);
    let result = await (fn.asyncBody ?? fn)(...args);
    while (result !== null && typeof result === "object" && (result as TailCall).__tail === true) {
      const t = result as TailCall;
      fn = this.checkCallable(t.f, t.args.length, false);
      result = await (fn.asyncBody ?? fn)(...t.args);
    }
    return result === undefined ? null : (result as PyValue);
  }

  /** Tail call marker: bounced on the caller's trampoline instead of growing the stack. */
  tail(f: PyValue, args: PyValue[]): TailCall {
    return { __tail: true, f, args };
  }

  /** Wrap a compiled function body with its metadata. */
  def(name: string, arity: number, fn: (...args: PyValue[]) => PyValue | TailCall): PyFunction {
    const f = fn as PyFunction;
    f.pyName = name;
    f.pyArity = arity;
    return f;
  }

  /**
   * Dual compilation: one Python function, two compiled bodies over the same
   * closure environment. The sync body is the function object itself (so
   * modules and `call` use it directly at full speed); the async twin rides
   * along for the program's async spine (`acall`).
   */
  def2(
    name: string,
    arity: number,
    syncFn: (...args: PyValue[]) => PyValue | TailCall,
    asyncFn: (...args: PyValue[]) => Promise<PyValue | TailCall>,
  ): PyFunction {
    const f = this.def(name, arity, syncFn);
    f.asyncBody = asyncFn;
    return f;
  }

  /**
   * What a TS module uses to invoke a user-defined Python function
   * synchronously (e.g. a sound wave sampled 44100 times per second).
   * Runs the sync body on the sync trampoline — no promises anywhere.
   */
  callSync(f: PyValue, args: PyValue[]): PyValue {
    return this.call(f, args);
  }

  assertCheck(v: PyValue): void {
    if (!this.truth(v)) throw new Py2JsRuntimeError("AssertionError", "AssertionError");
  }

  private builtin(name: string, arity: number, fn: (...args: PyValue[]) => PyValue): PyFunction {
    const f = this.def(name, arity, fn);
    f.pyBuiltin = true;
    return f;
  }

  /**
   * The native builtin core: the few builtins that cannot go through the
   * stdlib bridge (see stdlibBridge.ts, which supplies everything else from
   * the real src/stdlib groups). print and input are async/stream-based in
   * the stdlib; arity inspects CSE closures, which py2js functions are not.
   */
  readonly builtins: Record<string, PyValue> = {
    print: this.builtin("print", -1, (...args) => {
      // Same formatting as the stdlib's print: str() of each argument,
      // space-joined, one trailing newline (pyStr mirrors toPythonString).
      const line = args.map(pyStr).join(" ");
      this.output.push(line + "\n");
      this.onOutput?.(line);
      return null;
    }),
    input: this.builtin("input", -1, () => {
      throw new Py2JsRuntimeError(
        "RuntimeError",
        "input() is not supported by the py2js engine yet",
      );
    }),
    // Native rather than bridged: CSE's print_llist (stdlib/linked-list.ts)
    // is async (writes to the output stream directly), like print/input.
    print_llist: this.builtin("print_llist", 1, v => {
      const line = printLlist(v);
      this.output.push(line + "\n");
      this.onOutput?.(line);
      return null;
    }),
    arity: this.builtin("arity", 1, f => {
      if (typeof f !== "function") {
        throw new Py2JsRuntimeError(
          "TypeError",
          `unsupported argument type for arity: '${pyTypeName(f, !this.universalEquality)}'`,
        );
      }
      // Bridged stdlib builtins report their CSE minArgs (pyMinArgs); user
      // functions and native builtins report their parameter count, which is
      // what the CSE machine reports for its closures. The f.length fallback
      // covers bare JS functions that bypassed annotateHostFunction (e.g.
      // stuffed into rt.builtins directly).
      return BigInt(f.pyMinArgs ?? Math.max(0, f.pyArity ?? f.length));
    }),
  };
}

/**
 * Establish the PyFunction metadata invariant on a host-supplied function
 * (extraBuiltins — module bindings etc.). Compiled user functions always get
 * their metadata from def/def2; this is for plain JS functions arriving from
 * outside. Fills only what is missing: pyName from the binding name, pyArity
 * -1 (argument counts are not enforced for host functions — a rest-args
 * implementation reports Function#length 0, so enforcing it would wrongly
 * reject every call), pyMinArgs from Function#length for arity() reporting,
 * and pyBuiltin so rendering says <built-in function name>.
 */
export function annotateHostFunction(name: string, fn: PyValue): PyValue {
  if (typeof fn !== "function") return fn;
  const f = fn as Partial<PyFunction> & ((...args: PyValue[]) => PyValue | TailCall);
  if (f.pyArity === undefined) {
    f.pyMinArgs ??= f.length;
    f.pyArity = -1;
  }
  f.pyName ??= name;
  f.pyBuiltin ??= true;
  return f as PyFunction;
}
