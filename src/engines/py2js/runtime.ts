/**
 * py2js engine — runtime library.
 *
 * Native (unboxed) JS value model for SICPy chapters 1-2:
 *   int      -> bigint
 *   float    -> number
 *   bool     -> boolean
 *   str      -> string
 *   None     -> null
 *   complex  -> PyComplexNumber (src/types)
 *   list     -> PyPair (chapter 2's "list" is always a 2-element cons cell
 *               built by pair()/llist(); see stdlibBridge.ts for the
 *               conversion to/from CSE's flat 2-element list Value)
 *   function -> JS function carrying pyName/pyArity metadata
 *   opaque   -> PyOpaque (a module value with no py2js-native representation
 *               — e.g. a sound or image handle — held and passed around but
 *               not otherwise inspectable; see moduleInterop.ts)
 *
 * User values stay unboxed so V8 can JIT the compiled program; the Python
 * operator semantics live in the helpers below, which mirror
 * evaluateBinaryExpression / evaluateUnaryExpression in
 * src/engines/cse/operators.ts (the reference implementation) — same dispatch
 * order, same §1/§2 restrictions (identical at these two chapters — see
 * docs/specs/python_typing_middle_12.tex). The operator typing rules
 * themselves are specified in docs/specs/python_typing_front.tex,
 * python_typing_middle_12.tex and python_typing_back.tex; conformance against
 * them is pinned by src/tests/operator-conformance-py2js.test.ts, which
 * sweeps the full operator × type × type cross product against the CSE
 * machine. pyEquals's bool/function exclusion checks re-apply on every
 * recursive call into a pair's head/tail, matching CSE's structuralEquals
 * threading `restrictChapter12` through its own list recursion — since py2js
 * only supports chapters 1-2 so far, that check is simply unconditional here;
 * a chapter 3/4 PR will need to parameterize it the same way CSE does.
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
  | PyPair
  | PyOpaque
  | PyFunction;

/**
 * Chapter 2's pair: a 2-element cons cell built by pair()/llist(), the same
 * shape the CSE machine represents as a 2-element list Value. Mutable fields
 * to match that representation exactly, though nothing at chapter 2 can
 * actually mutate one — pairmutator (set_head/set_tail) is chapter 3+.
 */
export class PyPair {
  constructor(
    public head: PyValue,
    public tail: PyValue,
  ) {}
}

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

export function pyTypeName(v: PyValue): string {
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
      // Matches CPython's type(...).__name__ via typeTranslator in the CSE
      // machine (engines/cse/types.ts): a 2-element pair is always "list";
      // an unrecognized module value has no more specific name than "opaque".
      if (v instanceof PyPair) return "list";
      if (v instanceof PyOpaque) return "opaque";
      return "complex";
    default:
      return "NoneType";
  }
}

function unsupported(op: string, l: PyValue, r?: PyValue): never {
  const rhs = r === undefined ? "" : ` and '${pyTypeName(r)}'`;
  throw new Py2JsRuntimeError(
    "UnsupportedOperandTypeError",
    `unsupported operand type(s) for ${op}: '${pyTypeName(l)}'${rhs}`,
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
      if (v instanceof PyPair) {
        return { type: "list", value: [toDisplayValue(v.head), toDisplayValue(v.tail)] };
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
      if (v instanceof PyPair) return stringify(toDisplayValue(v));
      // Matches the CSE machine's toPythonString default case (stdlib/
      // utils.ts) for its "opaque" Value type.
      return v instanceof PyOpaque ? "<opaque object>" : v.toString();
    default:
      return "None";
  }
}

/** Whether `v` is a proper linked list: a chain of pairs terminated by None,
 * as opposed to an arbitrary pair — mirrors isProperList in
 * src/stdlib/linked-list.ts (the distinction print_llist uses below).
 * Iterative rather than (tail-)recursive: JS engines don't guarantee TCO, so
 * a long list would otherwise risk a stack overflow — the same failure mode
 * printLlist's own outer list-walking `while` loop below already avoids. */
function isProperList(v: PyValue): boolean {
  let current = v;
  while (current instanceof PyPair) {
    current = current.tail;
  }
  return current === null;
}

/**
 * print_llist's box-and-pointer rendering — ports the CSE machine's
 * _print_llist/_is_llist (src/stdlib/linked-list.ts): a proper list renders
 * as `llist(a, b, c)`, any other pair as bracket notation `[a, b]`
 * (recursively), and a non-pair leaf via toPythonString's repr mode (reused
 * directly, via toDisplayValue, rather than re-implementing string escaping)
 * — same as CSE's `toPythonString(value, true)` leaf case.
 */
function printLlist(v: PyValue): string {
  if (!isProperList(v)) {
    if (!(v instanceof PyPair)) return toPythonString(toDisplayValue(v), true);
    return `[${printLlist(v.head)}, ${printLlist(v.tail)}]`;
  }
  let s = "llist(";
  let current: PyValue = v;
  while (current instanceof PyPair) {
    s += printLlist(current.head) + ", ";
    current = current.tail;
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
function pyEquals(l: PyValue, r: PyValue): boolean {
  if (typeof l === "boolean" || typeof l === "function") unsupported("==", l, r);
  if (typeof r === "boolean" || typeof r === "function") unsupported("==", l, r);
  if (isNaNValue(l) || isNaNValue(r)) return false;
  if (isComplex(l) || isComplex(r)) {
    if (!isCoercibleToComplex(l) || !isCoercibleToComplex(r)) return false;
    return toComplex(l).equals(toComplex(r));
  }
  if (isNum(l) && isNum(r)) return numericCompare(l, r) === 0;
  if (l === null && r === null) return true;
  if (l instanceof PyPair && r instanceof PyPair) {
    // Identity shortcut first (mirrors CSE's structuralEquals — also lets a
    // self-referential pair compare equal to itself without recursing
    // forever, though chapter 2 has no pairmutator to build a cycle with).
    // The recursive pyEquals calls re-run this function's own bool/function
    // exclusion checks on each element, matching CSE's restrictChapter12
    // re-check at every level of list recursion.
    return l === r || (pyEquals(l.head, r.head) && pyEquals(l.tail, r.tail));
  }
  return l === r; // strings by value; mixed types (incl. pair vs non-pair) are simply unequal
}

/**
 * Ordering comparisons: int/float × int/float and str × str only at chapter 1
 * (bool and complex operands are errors — python_typing_middle_12.tex,
 * python_typing_back.tex). NaN is unordered: every comparison is False.
 */
function pyOrder(op: string, l: PyValue, r: PyValue): boolean {
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
  if (!isNum(l) || !isNum(r)) unsupported(op, l, r);
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

function complexBinop(op: string, l: PyValue, r: PyValue): PyComplexNumber {
  if (!isCoercibleToComplex(l) || !isCoercibleToComplex(r)) unsupported(op, l, r);
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
      unsupported(op, l, r);
  }
}

export class Py2JsRuntime {
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
        return pyEquals(l, r);
      case "!=":
        return !pyEquals(l, r);
      case "<":
      case "<=":
      case ">":
      case ">=":
        return pyOrder(op, l, r);
    }

    if (isComplex(l) || isComplex(r)) {
      return complexBinop(op, l, r);
    }

    // String concatenation: str + str only.
    if (typeof l === "string" || typeof r === "string") {
      if (op === "+" && typeof l === "string" && typeof r === "string") return l + r;
      unsupported(op, l, r);
    }

    if (!isNum(l) || !isNum(r)) unsupported(op, l, r);

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
        unsupported(op, l, r);
    }
  }

  unop(op: string, v: PyValue): PyValue {
    switch (op) {
      case "not":
        if (typeof v !== "boolean") unsupported("not", v);
        return !v;
      case "-":
        if (typeof v === "bigint") return -v;
        if (typeof v === "number") return -v;
        if (isComplex(v)) return new PyComplexNumber(-v.real, -v.imag);
        unsupported("-", v);
        break;
      case "+":
        if (isNum(v) || isComplex(v)) return v;
        unsupported("+", v);
    }
    throw new Py2JsRuntimeError("UnsupportedOperandTypeError", `bad unary operator ${op}`);
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
        // Pairs and opaque module values are always truthy — Python has no
        // "empty pair" concept (None is the empty *list*, already handled
        // above), and CSE's isFalsy default treats every other object as
        // truthy too.
        if (v instanceof PyPair || v instanceof PyOpaque) return true;
        return v.real !== 0 || v.imag !== 0;
      default:
        return false;
    }
  }

  /** Left operand of and/or must be bool (mirrors the CSE BOOL_OP instruction). */
  boolLeft(v: PyValue, op: string): boolean {
    if (typeof v !== "boolean") unsupported(op, v);
    return v;
  }

  private checkCallable(f: PyValue, nArgs: number, sync: boolean): PyFunction {
    if (typeof f !== "function") {
      throw new Py2JsRuntimeError("TypeError", `'${pyTypeName(f)}' object is not callable`);
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
          `unsupported argument type for arity: '${pyTypeName(f)}'`,
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
