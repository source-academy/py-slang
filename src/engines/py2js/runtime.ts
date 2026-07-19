/**
 * py2js engine — runtime library.
 *
 * Native (unboxed) JS value model for SICPy chapter 1:
 *   int      -> bigint
 *   float    -> number
 *   bool     -> boolean
 *   str      -> string
 *   None     -> null
 *   complex  -> PyComplexNumber (src/types)
 *   function -> JS function carrying pyName/pyArity metadata
 *
 * User values stay unboxed so V8 can JIT the compiled program; the Python
 * chapter-1 operator semantics live in the helpers below, which mirror
 * evaluateBinaryExpression / evaluateUnaryExpression in
 * src/engines/cse/operators.ts (the reference implementation) — same dispatch
 * order, same §1 restrictions. The operator typing rules themselves are
 * specified in docs/specs/python_typing_front.tex, python_typing_middle_12.tex
 * and python_typing_back.tex; conformance against them is pinned by
 * src/tests/operator-conformance-py2js.test.ts, which sweeps the full
 * operator × type × type cross product against the CSE machine.
 *
 * Proper tail calls: compiled functions return a TailCall marker from return
 * statements in tail position; `call` runs the trampoline. In dual mode every
 * user function carries a second, async body (def2) used on the program's
 * async spine (acall), while TS modules call back into Python synchronously
 * through callSync — see compiler.ts's mode documentation.
 */
import { numericCompare, pythonMod } from "../cse/utils";
import { toPythonFloat } from "../../stdlib/utils";
import { PyComplexNumber } from "../../types";

export type PyValue = bigint | number | boolean | string | null | PyComplexNumber | PyFunction;

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
      return v === null ? "NoneType" : "complex";
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
      return v === null ? "None" : v.toString();
    default:
      return "None";
  }
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
  return l === r; // strings by value; mixed types are simply unequal
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
        return v === null ? false : v.real !== 0 || v.imag !== 0;
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
