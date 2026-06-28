/**
 * Built-in functions and constants for the Python substitution stepper.
 *
 * The stepper has no global environment: a program's leftover free names are either user bindings
 * (already resolved by substitution at the statement level) or these language built-ins. This module
 * is the stepper's view of the Python §1/§2 standard library — see py-slang's
 * `docs/specs/python_standard.tex`, `python_misc.tex` and `math.ts` — namely the `math_*` constants
 * and functions plus the MISC library (`int`/`float`/`str`/`bool`/`repr`, the `is_*` predicates,
 * `abs`/`round`/`min`/`max`/`len`/`arity`/`print`/`error`).
 *
 * Only built-ins that fit the stepper's value model (int = `bigint`, float = `number`, bool, str,
 * `None`, and function values) are provided. Non-deterministic / interactive ones (`input`,
 * `time_time`, `random_random`) and the complex-number ones (`complex`/`real`/`imag`) are
 * intentionally omitted: a call to one stays irreducible and the stepper reports "Evaluation stuck",
 * which is the honest outcome for behaviour a pure substitution view cannot model.
 *
 * Each function receives already-reduced argument value nodes and returns the result value node, or
 * throws a Python-shaped `Error` (e.g. `TypeError: ...`). The driver catches the throw and ends the
 * run with "Evaluation stuck", exactly like the arithmetic faults raised in `reduce.ts`.
 */

import {
  type StepNode,
  isPairNode,
  isResultValue,
  literal,
  numberLiteral,
  pythonStringRepr,
  stringLiteral,
  unparse,
} from "./ast";
import { listArities, listBuiltins } from "./lists";

/* -------------------------------------------------------------------------- */
/*                                 Constants                                   */
/* -------------------------------------------------------------------------- */

const MATH_CONSTANTS: Record<string, number> = {
  math_e: Math.E,
  math_pi: Math.PI,
  math_tau: 2 * Math.PI,
  math_inf: Infinity,
  math_nan: NaN,
};

/** Whether `name` is a built-in constant (e.g. `math_pi`). */
export function isBuiltinConstantName(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(MATH_CONSTANTS, name);
}

/** The value node a built-in constant reduces to. Assumes {@link isBuiltinConstantName}. */
export function getBuiltinConstant(name: string): StepNode {
  return numberLiteral(MATH_CONSTANTS[name], true);
}

/* -------------------------------------------------------------------------- */
/*                          Value helpers / predicates                        */
/* -------------------------------------------------------------------------- */

function fail(message: string): never {
  throw new Error(message);
}

function typeError(message: string): never {
  return fail(`TypeError: ${message}`);
}

/** A Python `int`/`float`/`bool` (bool is an int subtype) as a JS number. Throws otherwise. */
function asNumber(node: StepNode, fn: string): number {
  if (node.type === "Literal") {
    const v = node.value;
    if (typeof v === "bigint") return Number(v);
    if (typeof v === "number") return v;
    if (typeof v === "boolean") return v ? 1 : 0;
  }
  return typeError(`${fn}() argument must be a number`);
}

const isFloatNode = (n: StepNode): boolean => n.type === "Literal" && typeof n.value === "number";
const isIntNode = (n: StepNode): boolean => n.type === "Literal" && typeof n.value === "bigint";
const isBoolNode = (n: StepNode): boolean => n.type === "Literal" && typeof n.value === "boolean";
const isStrNode = (n: StepNode): boolean => n.type === "Literal" && typeof n.value === "string";
const isNoneNode = (n: StepNode): boolean => n.type === "Literal" && n.value === null;
const isFunctionNode = (n: StepNode): boolean =>
  n.type === "ArrowFunctionExpression" ||
  n.type === "FunctionDeclaration" ||
  (n.type === "Identifier" && isBuiltinFunctionName(String(n.name)));

/* node constructors */
const intLiteral = (v: bigint): StepNode => literal(v, v.toString(), false);
const boolLiteral = (b: boolean): StepNode => literal(b, b ? "True" : "False");

/** Python `str()` / `repr()` of a stepper value. */
function pyStr(node: StepNode, repr: boolean): string {
  if (node.type === "Literal") {
    const v = node.value;
    if (typeof v === "string") return repr ? pythonStringRepr(v) : v;
    // numbers, ints, bools and None already carry their Python text in `raw`.
    return String(node.raw ?? v);
  }
  if (node.type === "ArrayExpression") {
    // A pair / linked list renders in box-and-pointer notation. Elements use repr (like
    // `linked_list_to_string`), so a string element shows quoted: pair("a", None) ⇒ ['a', None].
    return `[${(node.elements as StepNode[]).map(e => pyStr(e, true)).join(", ")}]`;
  }
  if (node.type === "ArrowFunctionExpression" || node.type === "FunctionDeclaration") {
    const name = (node.name ?? (node.id as StepNode | undefined)?.name) as string | undefined;
    return `<function ${name ?? "<lambda>"}>`;
  }
  if (node.type === "Identifier") return `<built-in function ${String(node.name)}>`;
  return unparse(node);
}

/** Python truthiness for the value subset the stepper handles (mirrors `reduce.ts`'s `isTruthy`). */
function truthy(node: StepNode): boolean {
  if (node.type === "ArrayExpression") return (node.elements as StepNode[]).length > 0;
  if (node.type !== "Literal") return true;
  const v = node.value;
  if (v === null || v === false) return false;
  if (v === true) return true;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "bigint") return v !== 0n;
  if (typeof v === "string") return v.length > 0;
  return true;
}

function checkArity(name: string, args: StepNode[], min: number, max: number | null): void {
  if (args.length < min || (max !== null && args.length > max)) {
    const want = max === null ? `at least ${min}` : min === max ? `${min}` : `${min} to ${max}`;
    typeError(`${name}() takes ${want} argument(s) but ${args.length} were given`);
  }
}

/** Round-half-to-even (Python's `round`) of `x` to an integer. */
function bankersRound(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

/* -------------------------------------------------------------------------- */
/*                               Math functions                               */
/* -------------------------------------------------------------------------- */

const MATH_UNARY_FLOAT: Record<string, (x: number) => number> = {
  math_sqrt: Math.sqrt,
  math_sin: Math.sin,
  math_cos: Math.cos,
  math_tan: Math.tan,
  math_asin: Math.asin,
  math_acos: Math.acos,
  math_atan: Math.atan,
  math_sinh: Math.sinh,
  math_cosh: Math.cosh,
  math_tanh: Math.tanh,
  math_asinh: Math.asinh,
  math_acosh: Math.acosh,
  math_atanh: Math.atanh,
  math_exp: Math.exp,
  math_expm1: Math.expm1,
  math_log2: Math.log2,
  math_log10: Math.log10,
  math_log1p: Math.log1p,
  math_cbrt: Math.cbrt,
  math_fabs: Math.abs,
  math_degrees: (x: number) => (x * 180) / Math.PI,
  math_radians: (x: number) => (x * Math.PI) / 180,
};

const MATH_BINARY_FLOAT: Record<string, (x: number, y: number) => number> = {
  math_pow: Math.pow,
  math_atan2: Math.atan2,
  math_hypot: Math.hypot,
  math_fmod: (x: number, y: number) => x % y,
  math_copysign: (x: number, y: number) => (Object.is(y, -0) || y < 0 ? -1 : 1) * Math.abs(x),
  math_remainder: (x: number, y: number) => x - Math.round(x / y) * y,
};

const MATH_UNARY_INT: Record<string, (x: number) => number> = {
  math_floor: Math.floor,
  math_ceil: Math.ceil,
  math_trunc: Math.trunc,
};

const MATH_PREDICATE: Record<string, (x: number) => boolean> = {
  math_isnan: (x: number) => Number.isNaN(x),
  math_isinf: (x: number) => !Number.isFinite(x) && !Number.isNaN(x),
  math_isfinite: (x: number) => Number.isFinite(x),
};

/* -------------------------------------------------------------------------- */
/*                       The built-in function dispatch table                 */
/* -------------------------------------------------------------------------- */

type BuiltinFn = (args: StepNode[]) => StepNode;

const BUILTIN_FUNCTIONS: Record<string, BuiltinFn> = {};

for (const [name, fn] of Object.entries(MATH_UNARY_FLOAT)) {
  BUILTIN_FUNCTIONS[name] = args => {
    checkArity(name, args, 1, 1);
    return numberLiteral(fn(asNumber(args[0], name)), true);
  };
}
for (const [name, fn] of Object.entries(MATH_BINARY_FLOAT)) {
  BUILTIN_FUNCTIONS[name] = args => {
    checkArity(name, args, 2, 2);
    return numberLiteral(fn(asNumber(args[0], name), asNumber(args[1], name)), true);
  };
}
for (const [name, fn] of Object.entries(MATH_UNARY_INT)) {
  BUILTIN_FUNCTIONS[name] = args => {
    checkArity(name, args, 1, 1);
    return intLiteral(BigInt(fn(asNumber(args[0], name))));
  };
}
for (const [name, pred] of Object.entries(MATH_PREDICATE)) {
  BUILTIN_FUNCTIONS[name] = args => {
    checkArity(name, args, 1, 1);
    return boolLiteral(pred(asNumber(args[0], name)));
  };
}

Object.assign(BUILTIN_FUNCTIONS, {
  // math_log(x) = natural log; math_log(x, base) = log of x in the given base.
  math_log: (args: StepNode[]): StepNode => {
    checkArity("math_log", args, 1, 2);
    const x = Math.log(asNumber(args[0], "math_log"));
    return numberLiteral(args.length === 2 ? x / Math.log(asNumber(args[1], "math_log")) : x, true);
  },
  math_factorial: (args: StepNode[]): StepNode => {
    checkArity("math_factorial", args, 1, 1);
    const n = asNumber(args[0], "math_factorial");
    if (!Number.isInteger(n) || n < 0) {
      fail("ValueError: factorial() not defined for negative or non-integer values");
    }
    let acc = 1n;
    for (let i = 2n; i <= BigInt(n); i++) acc *= i;
    return intLiteral(acc);
  },
  math_gcd: (args: StepNode[]): StepNode => {
    checkArity("math_gcd", args, 1, null);
    let g = 0n;
    for (const arg of args) {
      if (!isIntNode(arg)) typeError("math_gcd() argument must be an int");
      let b = (arg.value as bigint) < 0n ? -(arg.value as bigint) : (arg.value as bigint);
      while (b) {
        [g, b] = [b, g % b];
      }
    }
    return intLiteral(g);
  },

  // ── MISC library ──────────────────────────────────────────────────────────
  abs: (args: StepNode[]): StepNode => {
    checkArity("abs", args, 1, 1);
    const x = args[0];
    if (isIntNode(x)) {
      const v = x.value as bigint;
      return intLiteral(v < 0n ? -v : v);
    }
    if (isFloatNode(x) || isBoolNode(x))
      return numberLiteral(Math.abs(asNumber(x, "abs")), isFloatNode(x));
    return typeError("bad operand type for abs()");
  },
  int: (args: StepNode[]): StepNode => {
    checkArity("int", args, 0, 2);
    if (args.length === 0) return intLiteral(0n);
    const x = args[0];
    if (args.length === 2) {
      if (!isStrNode(x)) typeError("int() can't convert non-string with explicit base");
      const base = Number(asNumber(args[1], "int"));
      const parsed = parseInt((x.value as string).trim(), base);
      if (Number.isNaN(parsed)) fail(`ValueError: invalid literal for int() with base ${base}`);
      return intLiteral(BigInt(parsed));
    }
    if (isIntNode(x)) return x;
    if (isBoolNode(x)) return intLiteral((x.value as boolean) ? 1n : 0n);
    if (isFloatNode(x)) return intLiteral(BigInt(Math.trunc(x.value as number)));
    if (isStrNode(x)) {
      const s = (x.value as string).trim().replace(/_/g, "");
      if (!/^[+-]?\d+$/.test(s)) fail("ValueError: invalid literal for int() with base 10");
      return intLiteral(BigInt(s));
    }
    return typeError("int() argument must be a string, a number or a bool");
  },
  float: (args: StepNode[]): StepNode => {
    checkArity("float", args, 0, 1);
    if (args.length === 0) return numberLiteral(0, true);
    const x = args[0];
    if (isStrNode(x)) {
      const s = (x.value as string).trim().replace(/_/g, "").toLowerCase();
      const specials: Record<string, number> = {
        inf: Infinity,
        "-inf": -Infinity,
        infinity: Infinity,
        "-infinity": -Infinity,
        nan: NaN,
      };
      if (s in specials) return numberLiteral(specials[s], true);
      const n = Number(s);
      if (Number.isNaN(n) && s !== "nan") fail("ValueError: could not convert string to float");
      return numberLiteral(n, true);
    }
    return numberLiteral(asNumber(x, "float"), true);
  },
  bool: (args: StepNode[]): StepNode => {
    checkArity("bool", args, 0, 1);
    return boolLiteral(args.length === 0 ? false : truthy(args[0]));
  },
  str: (args: StepNode[]): StepNode => {
    checkArity("str", args, 0, 1);
    return stringLiteral(args.length === 0 ? "" : pyStr(args[0], false));
  },
  repr: (args: StepNode[]): StepNode => {
    checkArity("repr", args, 1, 1);
    return stringLiteral(pyStr(args[0], true));
  },
  len: (args: StepNode[]): StepNode => {
    checkArity("len", args, 1, 1);
    const x = args[0];
    if (isStrNode(x)) return intLiteral(BigInt([...(x.value as string)].length));
    if (x.type === "ArrayExpression") return intLiteral(BigInt((x.elements as StepNode[]).length));
    return typeError(`object of type '${pyTypeName(x)}' has no len()`);
  },
  round: (args: StepNode[]): StepNode => {
    checkArity("round", args, 1, 2);
    const x = args[0];
    const ndigits =
      args.length === 2 && !isNoneNode(args[1]) ? Number(asNumber(args[1], "round")) : null;
    if (ndigits === null) return intLiteral(BigInt(bankersRound(asNumber(x, "round"))));
    if (isIntNode(x)) return x; // rounding an int to n>=0 digits is itself
    const factor = 10 ** ndigits;
    return numberLiteral(bankersRound(asNumber(x, "round") * factor) / factor, true);
  },
  min: (args: StepNode[]): StepNode => selectExtreme("min", args, false),
  max: (args: StepNode[]): StepNode => selectExtreme("max", args, true),
  arity: (args: StepNode[]): StepNode => {
    checkArity("arity", args, 1, 1);
    const f = args[0];
    if (f.type === "ArrowFunctionExpression" || f.type === "FunctionDeclaration") {
      return intLiteral(BigInt((f.params as StepNode[]).length));
    }
    if (f.type === "Identifier" && isBuiltinFunctionName(String(f.name))) {
      return intLiteral(BigInt(BUILTIN_MIN_ARGS[String(f.name)] ?? 1));
    }
    return typeError("arity() argument must be a function");
  },
  print: (args: StepNode[]): StepNode => {
    // A pure substitution view has nowhere to send console output, so `print` just yields `None`
    // (its Python return value); the printed text is not part of the reduction being visualised.
    void args;
    return literal(null, "None");
  },
  error: (args: StepNode[]): StepNode => {
    // Like Python's `error`, aborts the run; surfaces as an "Evaluation stuck" step with this text.
    fail("Error: " + args.map(a => pyStr(a, false)).join(" "));
  },

  // Type predicates. `is_complex` is always False (the stepper has no complex value).
  is_int: (args: StepNode[]): StepNode => predicate("is_int", args, isIntNode),
  is_float: (args: StepNode[]): StepNode => predicate("is_float", args, isFloatNode),
  is_boolean: (args: StepNode[]): StepNode => predicate("is_boolean", args, isBoolNode),
  is_string: (args: StepNode[]): StepNode => predicate("is_string", args, isStrNode),
  is_none: (args: StepNode[]): StepNode => predicate("is_none", args, isNoneNode),
  is_function: (args: StepNode[]): StepNode => predicate("is_function", args, isFunctionNode),
  is_complex: (args: StepNode[]): StepNode => predicate("is_complex", args, () => false),
});

// The Python §2 linked-list library (pairs and lists). Names follow Python (`pair`, `head`,
// `linked_list`, `map_linked_list`, …) while pairs/lists display like Source. See `./lists.ts`.
Object.assign(BUILTIN_FUNCTIONS, listBuiltins);

/** Minimum argument counts for the built-ins, used by `arity` on a built-in name. */
const BUILTIN_MIN_ARGS: Record<string, number> = {
  min: 1,
  max: 1,
  int: 0,
  float: 0,
  bool: 0,
  str: 0,
  print: 0,
  error: 0,
  math_log: 1,
  math_gcd: 1,
};
for (const name of Object.keys(MATH_BINARY_FLOAT)) BUILTIN_MIN_ARGS[name] = 2;
Object.assign(BUILTIN_MIN_ARGS, listArities);

function predicate(name: string, args: StepNode[], test: (n: StepNode) => boolean): StepNode {
  checkArity(name, args, 1, 1);
  return boolLiteral(test(args[0]));
}

function pyTypeName(node: StepNode): string {
  if (isIntNode(node)) return "int";
  if (isFloatNode(node)) return "float";
  if (isBoolNode(node)) return "bool";
  if (isStrNode(node)) return "str";
  if (isNoneNode(node)) return "NoneType";
  if (isPairNode(node)) return "pair";
  if (isFunctionNode(node)) return "function";
  return node.type;
}

function selectExtreme(name: string, args: StepNode[], wantMax: boolean): StepNode {
  checkArity(name, args, 1, null);
  const numeric = args.every(a => isIntNode(a) || isFloatNode(a) || isBoolNode(a));
  const strings = args.every(isStrNode);
  if (!numeric && !strings) {
    typeError(`'${name}' arguments must be all numbers or all strings`);
  }
  let best = args[0];
  for (let i = 1; i < args.length; i++) {
    const a = numeric ? asNumber(args[i], name) : (args[i].value as string);
    const b = numeric ? asNumber(best, name) : (best.value as string);
    if (wantMax ? a > b : a < b) best = args[i];
  }
  return best;
}

/* -------------------------------------------------------------------------- */
/*                                  Exports                                    */
/* -------------------------------------------------------------------------- */

/** Whether `name` is a callable built-in (e.g. `abs`, `math_sqrt`). */
export function isBuiltinFunctionName(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(BUILTIN_FUNCTIONS, name);
}

/** Applies the built-in `name` to already-reduced value `args`. Throws on misuse (→ stuck). */
export function applyBuiltin(name: string, args: StepNode[]): StepNode {
  const fn = BUILTIN_FUNCTIONS[name];
  if (fn === undefined) fail(`NameError: name '${name}' is not defined`);
  return fn(args);
}

/**
 * Whether `node` is a value the stepper may end on. Extends `isResultValue` (which excludes a bare
 * `Identifier`) to also accept a built-in *function* name — `abs`, `math_sqrt`, … are first-class
 * function values, so a program ending on one is complete, not stuck.
 */
export function isStepperValue(node: StepNode): boolean {
  return (
    isResultValue(node) || (node.type === "Identifier" && isBuiltinFunctionName(String(node.name)))
  );
}
