/**
 * py2js experiment — runtime library.
 *
 * Native JS value model for SICPy chapter 1:
 *   int      -> bigint
 *   float    -> number
 *   bool     -> boolean
 *   str      -> string
 *   None     -> null
 *   function -> JS function carrying pyName/pyArity metadata
 *
 * The point of the experiment is that user values are *unboxed* JS values, so
 * V8 can JIT the compiled program; Python semantics live in the operator
 * helpers below, which mirror src/engines/cse/operators.ts at chapter 1.
 *
 * Proper tail calls: compiled functions return a TailCall marker from return
 * statements in tail position; `call` runs the trampoline (same scheme as
 * js-slang's transpiler, see ../../../js-slang/src/transpiler/transpiler.ts).
 */
import { numericCompare, pythonMod } from "../../src/engines/cse/utils";
import { toPythonFloat } from "../../src/stdlib/utils";

export type PyValue = bigint | number | boolean | string | null | PyFunction;

export interface PyFunction {
  (...args: PyValue[]): PyValue | TailCall;
  pyName: string;
  /** Number of parameters; -1 means variadic (builtins like print). */
  pyArity: number;
  pyBuiltin?: boolean;
  /**
   * Dual compilation: the async twin of this (sync) body, sharing the same
   * closure environment. Present on every user function compiled in dual
   * mode; absent on builtins (which are plain sync JS, or return a Promise
   * that acall awaits).
   */
  asyncBody?: (...args: PyValue[]) => Promise<PyValue | TailCall> | PyValue | TailCall;
  /**
   * Module functions that require an asynchronous frontend round-trip
   * (channel request/response). Callable only on the async path; callSync
   * rejects them so a module-driven synchronous callback fails loudly
   * instead of returning an unawaited Promise.
   */
  asyncOnly?: boolean;
}

export interface TailCall {
  __tail: true;
  f: PyValue;
  args: PyValue[];
}

export class PyRuntimeError extends Error {
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
    default:
      return "NoneType";
  }
}

function unsupported(op: string, l: PyValue, r?: PyValue): never {
  const rhs = r === undefined ? "" : ` and '${pyTypeName(r)}'`;
  throw new PyRuntimeError(
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
    default:
      return "None";
  }
}

const isNum = (v: PyValue): v is bigint | number => typeof v === "bigint" || typeof v === "number";

/** Chapter 1/2 equality excludes bool and function operands entirely. */
function pyEquals(l: PyValue, r: PyValue): boolean {
  if (typeof l === "boolean" || typeof l === "function") unsupported("==", l, r);
  if (typeof r === "boolean" || typeof r === "function") unsupported("==", l, r);
  if (typeof l === "number" && Number.isNaN(l)) return false;
  if (typeof r === "number" && Number.isNaN(r)) return false;
  if (isNum(l) && isNum(r)) return numericCompare(l, r) === 0;
  if (l === null && r === null) return true;
  return l === r; // strings by value; mixed types are simply unequal
}

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
  // Chapter 1: only int and float are orderable (bool is excluded).
  if (!isNum(l) || !isNum(r)) unsupported(op, l, r);
  if ((typeof l === "number" && Number.isNaN(l)) || (typeof r === "number" && Number.isNaN(r))) {
    return false; // NaN is unordered, as in CPython
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

export class Py2JsRuntime {
  output: string[] = [];

  /** None singleton alias so compiled code can say __py.None. */
  readonly None = null;

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
          if (r === 0n) throw new PyRuntimeError("ZeroDivisionError", "division by zero");
          return Number(l) / Number(r);
        case "//":
          if (r === 0n)
            throw new PyRuntimeError("ZeroDivisionError", "integer division or modulo by zero");
          return (l - pythonMod(l, r)) / r;
        case "%":
          if (r === 0n)
            throw new PyRuntimeError("ZeroDivisionError", "integer division or modulo by zero");
          return pythonMod(l, r);
        case "**":
          if (l === 0n && r < 0n)
            throw new PyRuntimeError(
              "ZeroDivisionError",
              "0.0 cannot be raised to a negative power",
            );
          return r < 0n ? Number(l) ** Number(r) : l ** r;
      }
    }

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
        if (b === 0) throw new PyRuntimeError("ZeroDivisionError", "float division by zero");
        return a / b;
      case "//":
        if (b === 0) throw new PyRuntimeError("ZeroDivisionError", "float floor division by zero");
        return Math.floor(a / b);
      case "%":
        if (b === 0) throw new PyRuntimeError("ZeroDivisionError", "float modulo");
        return pythonMod(a, b);
      case "**":
        if (a === 0 && b < 0)
          throw new PyRuntimeError("ZeroDivisionError", "0.0 cannot be raised to a negative power");
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
        unsupported("-", v);
        break;
      case "+":
        if (isNum(v)) return v;
        unsupported("+", v);
    }
    throw new PyRuntimeError("UnsupportedOperandTypeError", `bad unary operator ${op}`);
  }

  /**
   * Python truthiness, as the CSE machine's BRANCH instruction applies it to
   * `if` and ternary conditions (its WHILE instruction demands bool, but
   * chapter 1 has no loops).
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
      default:
        return false; // None
    }
  }

  /** Left operand of and/or must be bool (mirrors the CSE BOOL_OP instruction). */
  boolLeft(v: PyValue, op: string): boolean {
    if (typeof v !== "boolean") unsupported(op, v);
    return v;
  }

  private checkCallable(f: PyValue, nArgs: number): PyFunction {
    if (typeof f !== "function") {
      throw new PyRuntimeError("TypeError", `'${pyTypeName(f)}' object is not callable`);
    }
    if (f.pyArity >= 0 && f.pyArity !== nArgs) {
      throw new PyRuntimeError(
        "TypeError",
        `${f.pyName}() takes ${f.pyArity} argument${f.pyArity === 1 ? "" : "s"} but ${nArgs} ${nArgs === 1 ? "was" : "were"} given`,
      );
    }
    return f;
  }

  /** Non-tail call: run the trampoline until a real value comes back. */
  call(f: PyValue, args: PyValue[]): PyValue {
    let fn = this.checkCallable(f, args.length);
    if (fn.asyncOnly) {
      throw new PyRuntimeError(
        "TypeError",
        `${fn.pyName}() needs a frontend round-trip and cannot be called from a synchronous module callback`,
      );
    }
    let result = fn(...args);
    while (result !== null && typeof result === "object" && (result as TailCall).__tail === true) {
      const t = result as TailCall;
      fn = this.checkCallable(t.f, t.args.length);
      if (fn.asyncOnly) {
        throw new PyRuntimeError(
          "TypeError",
          `${fn.pyName}() needs a frontend round-trip and cannot be called from a synchronous module callback`,
        );
      }
      result = fn(...t.args);
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
    let fn = this.checkCallable(f, args.length);
    let result = await (fn.asyncBody ?? fn)(...args);
    while (result !== null && typeof result === "object" && (result as TailCall).__tail === true) {
      const t = result as TailCall;
      fn = this.checkCallable(t.f, t.args.length);
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
    if (!this.truth(v)) throw new PyRuntimeError("AssertionError", "AssertionError");
  }

  private builtin(name: string, arity: number, fn: (...args: PyValue[]) => PyValue): PyFunction {
    const f = this.def(name, arity, fn);
    f.pyBuiltin = true;
    return f;
  }

  /**
   * Minimal chapter-1 builtin set — enough for the experiment's demos and
   * benchmarks. A real py2js engine would bridge src/stdlib (misc + math)
   * instead; see README.
   */
  readonly builtins: Record<string, PyValue> = {
    print: this.builtin("print", -1, (...args) => {
      this.output.push(args.map(pyStr).join(" ") + "\n");
      return null;
    }),
    str: this.builtin("str", 1, v => pyStr(v)),
    abs: this.builtin("abs", 1, v => {
      if (typeof v === "bigint") return v < 0n ? -v : v;
      if (typeof v === "number") return Math.abs(v);
      throw new PyRuntimeError("TypeError", `bad operand type for abs(): '${pyTypeName(v)}'`);
    }),
    max: this.builtin("max", 2, (a, b) => (pyOrder(">=", a!, b!) ? a! : b!)),
    min: this.builtin("min", 2, (a, b) => (pyOrder("<=", a!, b!) ? a! : b!)),
    math_sqrt: this.numericBuiltin("math_sqrt", Math.sqrt),
    math_exp: this.numericBuiltin("math_exp", Math.exp),
    math_log: this.numericBuiltin("math_log", Math.log),
    math_sin: this.numericBuiltin("math_sin", Math.sin),
    math_cos: this.numericBuiltin("math_cos", Math.cos),
    math_floor: this.builtin("math_floor", 1, v => {
      if (typeof v === "bigint") return v;
      if (typeof v === "number") return BigInt(Math.floor(v));
      throw new PyRuntimeError("TypeError", `must be real number, not ${pyTypeName(v)}`);
    }),
    math_pi: Math.PI,
    math_e: Math.E,
  };

  private numericBuiltin(name: string, fn: (x: number) => number): PyFunction {
    return this.builtin(name, 1, v => {
      if (!isNum(v))
        throw new PyRuntimeError("TypeError", `must be real number, not ${pyTypeName(v)}`);
      return fn(Number(v));
    });
  }
}
