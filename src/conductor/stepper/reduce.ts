/**
 * The substitution-model reducer for the Python stepper.
 *
 * Reduction is the standard small-step substitution model used by Source's stepper, adapted to the
 * estree-shaped {@link StepNode} tree:
 *  - expressions reduce leftmost-innermost (operands first, then the operator/application),
 *  - `and`/`or`/`if` short-circuit (only the controlling sub-expression is reduced eagerly),
 *  - applying a `lambda`/`def` substitutes arguments for parameters (and the function's own name, so
 *    recursive calls resolve) in the body; a multi-statement `def` body (e.g. an `if/else` with
 *    `return`s, or local bindings) reduces as a *block expression*, statement by statement, until a
 *    `return` exits with its value (falling off the end yields `None`),
 *  - at the statement level, an assignment or function definition binds a name by substituting its
 *    value into the following statements (the substitution model's treatment of `const`).
 *
 * Each {@link reduceProgram} call performs exactly one contraction and reports the redex/result so
 * the driver can emit before/after markers. It returns `null` once the program is in normal form.
 *
 * Known limitations (acceptable for a teaching stepper): integers use JS `bigint` (exact, but large
 * exponents may be slow); float arithmetic uses JS `number` (IEEE 754); a local binding inside a
 * function body that shadows a parameter is not alpha-renamed; re-binding an already-substituted name
 * in a later statement is not tracked.
 * Recursion works (a function's name is re-bound in its body on each application) but, like Source, is
 * bounded only by the step limit — a non-terminating recursion stops at "Maximum number of steps".
 */

import type { DataType, TypedValue } from "@sourceacademy/conductor/types";

import {
  type ComplexValue,
  type StepNode,
  clone,
  complexLiteral,
  isComplexValue,
  isEmptyList,
  isFunctionValue,
  isModuleFunctionNode,
  isPairNode,
  isResultValue,
  isValue,
  literal,
  numberLiteral,
  paramNames,
  stringLiteral,
  substitute,
  substituteRest,
  unparse,
} from "./ast";
import {
  applyBuiltin,
  checkArity,
  formatPrintOutput,
  isBuiltinFunctionName,
  isSpecialFormName,
  isStepperValue,
  pyStr,
} from "./builtins";
import type { StepperContext } from "./context";
import { formatPrintLlistOutput } from "./lists";
import { callModuleFunction, type ImportBinding } from "./moduleInterop";

export interface ReduceResult {
  /**
   * The program/expression after this single contraction. This is *also* exactly what the after step
   * displays: the after step's tree is always identical to the following before step's tree — only the
   * highlighted redex and its color (red before, green after, none once a whole statement is consumed
   * rather than replaced in place) differ between them. A contraction never fabricates an intermediate
   * "about to vanish, still here" tree — see `preRedex`/`postRedex` below for how a statement that is
   * removed outright (a binding substituted away, a `pass`/import dropped, an `if`'s branch inlined)
   * still gets a meaningful *before* highlight without needing one after.
   */
  node: StepNode;
  /** The node in the *before* tree that was contracted (highlighted before the step). */
  preRedex: StepNode;
  /**
   * The node in `node` that is the contraction's result (highlighted after the step). Set only when the
   * redex is visibly replaced in place by a value that survives into `node` (an operator's result, a
   * call's return value, an argument substituted into a function body). Left `undefined` when the whole
   * redex is consumed without leaving a replacement in place (a `VariableDeclaration`/`FunctionDeclaration`
   * substituted into the rest of the block, a dropped `pass`/import, a finished top-level expression
   * statement discarded) — the after step then shows `node` with no highlight at all, past tense
   * explanation only.
   */
  postRedex?: StepNode;
  /** A human-readable description shown on the *after* step, past tense ("… evaluated"). */
  explanation: string;
  /** The same description shown on the *before* step, present-continuous ("… evaluating") — the same
   * event, described as about to happen rather than just having happened. */
  beforeExplanation: string;
  /** Text this contraction writes to the program's output (only a `print(...)` call does — see
   * `contractCall`). The driver appends it to the running output shown from the *after* step onward, so
   * a `print`'s text first appears on its "Ran print" step. `undefined` for every other contraction. */
  output?: string;
  /** Whether this contraction is a `breakpoint()` statement (see `stepHead`'s `ExpressionStatement`
   * case) — the driver's cue to flag the *before* step as the host's breakpoint-navigation target,
   * independent of the redex node's actual type. `undefined`/falsy for every other contraction. */
  isBreakpoint?: boolean;
}

/* -------------------------------------------------------------------------- */
/*                          Values & Python semantics                         */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*                          Expression contractions                           */
/* -------------------------------------------------------------------------- */

const boolLiteral = (b: boolean): StepNode => literal(b, b ? "True" : "False");
const isBoolNode = (n: StepNode): boolean => n.type === "Literal" && typeof n.value === "boolean";

/** A JS value that is a Python numeric (int = `bigint`, float = `number`). Unlike native Python,
 * `bool` is not an int subtype in this dialect — it is not a valid operand to *any* arithmetic or
 * comparison operator (only to `and`/`or`/`not`, and to explicit conversions like `int()`), so it is
 * deliberately excluded here. See `contractLogical` and `contractUnary`'s `not` case for the
 * `and`/`or`/`not` rule, and `reportBinaryTypeError` for how a `bool` operand is diagnosed. */
function isNumericValue(v: unknown): v is bigint | number {
  return typeof v === "bigint" || typeof v === "number";
}

/** Exact integer arithmetic (Python ints and bools, which are ints). */
function intBinary(op: string, l: bigint, r: bigint): StepNode | null {
  if (r === 0n && (op === "/" || op === "//" || op === "%")) {
    throw new Error("ZeroDivisionError: division by zero");
  }
  if (l === 0n && r < 0n && op === "**") {
    throw new Error("ZeroDivisionError: 0.0 cannot be raised to a negative power");
  }
  switch (op) {
    case "+":
      return literal(l + r, String(l + r), false);
    case "-":
      return literal(l - r, String(l - r), false);
    case "*":
      return literal(l * r, String(l * r), false);
    case "/":
      return numberLiteral(Number(l) / Number(r), true);
    case "//": {
      const q = l / r;
      const floored = l % r !== 0n && l < 0n !== r < 0n ? q - 1n : q;
      return literal(floored, String(floored), false);
    }
    case "%": {
      const rem = ((l % r) + r) % r;
      return literal(rem, String(rem), false);
    }
    case "**":
      return r < 0n
        ? numberLiteral(Number(l) ** Number(r), true)
        : literal(l ** r, String(l ** r), false);
    case "<":
      return boolLiteral(l < r);
    case ">":
      return boolLiteral(l > r);
    case "<=":
      return boolLiteral(l <= r);
    case ">=":
      return boolLiteral(l >= r);
    case "==":
      return boolLiteral(l === r);
    case "!=":
      return boolLiteral(l !== r);
    default:
      return null;
  }
}

/** Floating-point arithmetic (used when any operand is a float; Python promotes int→float). */
function floatBinary(op: string, l: number, r: number, pyFloat: boolean): StepNode | null {
  if (r === 0 && (op === "/" || op === "//" || op === "%")) {
    throw new Error("ZeroDivisionError: division by zero");
  }
  if (l === 0 && r < 0 && op === "**") {
    throw new Error("ZeroDivisionError: 0.0 cannot be raised to a negative power");
  }
  switch (op) {
    case "+":
      return numberLiteral(l + r, pyFloat);
    case "-":
      return numberLiteral(l - r, pyFloat);
    case "*":
      return numberLiteral(l * r, pyFloat);
    case "/":
      return numberLiteral(l / r, true);
    case "//":
      return numberLiteral(Math.floor(l / r), pyFloat);
    case "%":
      return numberLiteral(((l % r) + r) % r, pyFloat);
    case "**":
      return numberLiteral(l ** r, pyFloat || l ** r !== Math.floor(l ** r));
    case "<":
      return boolLiteral(l < r);
    case ">":
      return boolLiteral(l > r);
    case "<=":
      return boolLiteral(l <= r);
    case ">=":
      return boolLiteral(l >= r);
    case "==":
      return boolLiteral(l === r);
    case "!=":
      return boolLiteral(l !== r);
    default:
      return null;
  }
}

/** `a / b` for complex numbers via CPython's branch-scaled algorithm (avoids needless overflow /
 * underflow vs. the textbook `a * conj(b) / |b|²` formula) — ported from `PyComplexNumber.div` in
 * `src/types/value-types.ts`; the zero-divisor check is the caller's job (mirrors `intBinary`). */
function complexDiv(a: ComplexValue, b: ComplexValue): ComplexValue {
  const absC = Math.abs(b.real);
  const absD = Math.abs(b.imag);
  if (absD < absC) {
    const ratio = b.imag / b.real;
    const denom = b.real + b.imag * ratio;
    return { real: (a.real + a.imag * ratio) / denom, imag: (a.imag - a.real * ratio) / denom };
  }
  const ratio = b.real / b.imag;
  const denom = b.imag + b.real * ratio;
  return { real: (a.real * ratio + a.imag) / denom, imag: (a.imag * ratio - a.real) / denom };
}

/** `a ** b` for complex numbers via polar form (`a = r·e^iθ`, so `a**b = e^(b·(ln r + iθ))`) — ported
 * from `PyComplexNumber.pow`. `0 ** b` for a negative-real or non-real `b` is undefined (mirrors
 * `intBinary`/`floatBinary`'s `0 ** negative` → `ZeroDivisionError`, extended to complex exponents). */
function complexPow(a: ComplexValue, b: ComplexValue): ComplexValue {
  const r = Math.hypot(a.real, a.imag);
  if (r === 0) {
    if (b.real === 0 && b.imag === 0) {
      return { real: 1, imag: 0 };
    }
    if (b.real < 0 || b.imag !== 0) {
      throw new Error("ZeroDivisionError: 0 cannot be raised to a negative or complex power");
    }
    return { real: 0, imag: 0 };
  }

  const theta = Math.atan2(a.imag, a.real);
  const logR = Math.log(r);
  const realExp = b.real * logR - b.imag * theta;
  const imagExp = b.imag * logR + b.real * theta;
  const scale = Math.exp(realExp);
  return { real: scale * Math.cos(imagExp), imag: scale * Math.sin(imagExp) };
}

/**
 * Complex arithmetic: `+,-,*,/,**` promote like the real evaluator (any `int`/`float` operand mixed
 * with a `complex` one promotes the whole operation to complex — see `contractBinary`'s call site,
 * which converts both operands to {@link ComplexValue} before calling this), and `==`/`!=` compare
 * component-wise. There is no complex row for `//`, `%`, or the ordering operators in this dialect
 * (Python's `complex` has no total order) — `default: null` leaves those to `reportBinaryTypeError`.
 */
function complexBinary(op: string, l: ComplexValue, r: ComplexValue): StepNode | null {
  switch (op) {
    case "+":
      return complexLiteral({ real: l.real + r.real, imag: l.imag + r.imag });
    case "-":
      return complexLiteral({ real: l.real - r.real, imag: l.imag - r.imag });
    case "*":
      return complexLiteral({
        real: l.real * r.real - l.imag * r.imag,
        imag: l.real * r.imag + l.imag * r.real,
      });
    case "/":
      if (r.real === 0 && r.imag === 0) {
        throw new Error("ZeroDivisionError: complex division by zero");
      }
      return complexLiteral(complexDiv(l, r));
    case "**":
      return complexLiteral(complexPow(l, r));
    case "==":
      return boolLiteral(l.real === r.real && l.imag === r.imag);
    case "!=":
      return boolLiteral(l.real !== r.real || l.imag !== r.imag);
    default:
      return null;
  }
}

/** Promotes an already-reduced binary operand to {@link ComplexValue} for a mixed complex operation
 * (e.g. `2 + (1+2j)`), or `null` if it isn't `int`/`float`/`complex` at all (e.g. a `str`/`bool`/`None`
 * operand, which stays a graceful "stuck" or a `reportBinaryTypeError` diagnosis, exactly as a
 * non-numeric operand does for plain `int`/`float` arithmetic). */
function toComplexValue(v: unknown): ComplexValue | null {
  if (isComplexValue(v)) return v;
  if (typeof v === "bigint") return { real: Number(v), imag: 0 };
  if (typeof v === "number") return { real: v, imag: 0 };
  return null;
}

const ORDER_OPS = new Set(["<", ">", "<=", ">="]);

/**
 * The Python type name of a *concrete value* operand (for an operator error message), or `null` when
 * `node` is something we deliberately do not diagnose — a bare `Identifier` (a built-in/unbound name),
 * an `ArrayExpression` (a pair/list, whose operators Python *does* define), or an unreduced term — so
 * those stay a graceful "stuck" rather than risk reporting a wrong error.
 */
function valueTypeName(node: StepNode): string | null {
  if (node.type === "Literal") {
    const v = node.value;
    if (typeof v === "bigint") return "int";
    if (typeof v === "number") return "float";
    if (typeof v === "boolean") return "bool";
    if (typeof v === "string") return "str";
    if (v === null) return "NoneType";
    if (isComplexValue(v)) return "complex";
  }
  if (isFunctionValue(node)) return "function";
  return null;
}

/**
 * A human-readable Python type name for `and`/`or`/`not`'s non-bool-operand error. Like
 * `valueTypeName`, but also names a pair/list value and a bare built-in function reference (e.g.
 * `abs`) — the two stepper value shapes `valueTypeName` deliberately leaves undiagnosed for arithmetic
 * (see its call site in `contractBinary`) — since `and`/`or`/`not` reject every non-bool *value*, not
 * just the primitives arithmetic can misuse. Only called once `isStepperValue` has confirmed `node` is
 * a genuine value.
 */
function operandTypeName(node: StepNode): string {
  const t = valueTypeName(node);
  if (t !== null) return t;
  return node.type === "ArrayExpression" ? "pair" : "function";
}

/**
 * Throws a Python `TypeError` for a binary operation that produced no result because its operand types
 * are genuinely unsupported (e.g. `1 + "a"`, `None < 2`, `True == 1`, a function in arithmetic). The
 * driver turns the throw into an error step before "Evaluation stuck", exactly as it already does for
 * `ZeroDivisionError`. `==`/`!=` reach here only when excluded from this dialect's any x any equality
 * (see docs/specs/python_typing_middle_12.tex): a `bool` or function operand (e.g. `True == 1`, two
 * functions) — every other pair, already contracted above by `contractBinary`'s structural-equality
 * fallback, never reaches this function for `==`/`!=`. `str * int` repetition and `str % …` formatting
 * are combinations Python *does* allow but this teaching stepper simply does not model; they are left
 * as a silent "stuck" instead, so a valid operation is never mislabelled as an error.
 */
function reportBinaryTypeError(op: string, left: StepNode, right: StepNode): void {
  const lt = valueTypeName(left);
  const rt = valueTypeName(right);
  if (lt === null || rt === null) return;

  if (op === "*" && ((lt === "str" && rt === "int") || (lt === "int" && rt === "str"))) return; // repeat
  if (op === "%" && lt === "str") return; // %-formatting

  throw new Error(
    ORDER_OPS.has(op)
      ? `TypeError: '${op}' not supported between instances of '${lt}' and '${rt}'`
      : `TypeError: unsupported operand type(s) for ${op}: '${lt}' and '${rt}'`,
  );
}

/** String `+` (concatenation), equality and lexicographic ordering — the only binary operators this
 * dialect defines for `(string, string)` operands (there is no string row for `-,*,/,//,%,**`). */
function stringBinary(op: string, l: string, r: string): StepNode | null {
  switch (op) {
    case "+":
      return stringLiteral(l + r);
    case "==":
      return boolLiteral(l === r);
    case "!=":
      return boolLiteral(l !== r);
    case "<":
      return boolLiteral(l < r);
    case ">":
      return boolLiteral(l > r);
    case "<=":
      return boolLiteral(l <= r);
    case ">=":
      return boolLiteral(l >= r);
    default:
      return null;
  }
}

/** Whether `node`'s value is excluded from Python §1/§2's `==`/`!=` (see
 * docs/specs/python_typing_middle_12.tex: `bool,function x any -> error`, `any x bool,function ->
 * error`) — every other value, including `None` and pairs, is a valid operand. */
function excludedFromEquality(node: StepNode): boolean {
  return isBoolNode(node) || isFunctionValue(node);
}

/**
 * Structural equality between two fully-reduced values, following Python §1/§2's any x any `==`/`!=`
 * rule (see docs/specs/python_typing_middle_12.tex). `None` equals `None`; pairs compare element-wise,
 * recursively, as in Python; numbers compare across int/float/complex (bigints exactly, as `intBinary`
 * does at the top level; a mixed int/float pair promotes to `number`, with that type's usual precision
 * limits — matching `contractBinary`'s existing top-level promotion); values of differing "shape" (e.g.
 * a pair and `None`, or an `int` and a `str`) are unequal. `bool`/function operands are re-checked
 * against `excludedFromEquality` at *every* recursion level, not just the top level, so a bool/function
 * nested inside a pair (e.g. `pair(1, True) == pair(1, True)`) is still a TypeError, not a
 * silently-wrong `False` — mirroring the CSE engine's `structuralEquals` in `src/engines/cse/operators.ts`.
 * Same-domain numeric/string top-level operands are already resolved by `contractBinary`'s per-type
 * dispatch above and never reach here at the top level, but recursing into a pair's elements can hit
 * any combination, so every case is handled here too.
 */
function structuralEquals(op: string, left: StepNode, right: StepNode): boolean {
  if (excludedFromEquality(left) || excludedFromEquality(right)) {
    // Not `reportBinaryTypeError`: it silently no-ops when a side's `valueTypeName` is `null` (its
    // deliberate "stuck, not error" fallback for arithmetic on a pair/function — see its own doc
    // comment), which would swallow this genuine bool/function equality error whenever the *other*
    // operand happens to be a pair (e.g. `pair(1, 2) == True`). `operandTypeName` names every operand
    // shape reaching here, so this always throws.
    throw new Error(
      `TypeError: unsupported operand type(s) for ${op}: '${operandTypeName(left)}' and '${operandTypeName(right)}'`,
    );
  }
  if (isPairNode(left) && isPairNode(right)) {
    const le = left.elements as StepNode[];
    const re = right.elements as StepNode[];
    return structuralEquals(op, le[0], re[0]) && structuralEquals(op, le[1], re[1]);
  }
  if (isPairNode(left) || isPairNode(right)) return false;
  if (isEmptyList(left) || isEmptyList(right)) return isEmptyList(left) && isEmptyList(right);
  if (left.type !== "Literal" || right.type !== "Literal") return false;
  const l = left.value;
  const r = right.value;
  if (typeof l === "bigint" && typeof r === "bigint") return l === r;
  if (isNumericValue(l) && isNumericValue(r)) return Number(l) === Number(r);
  if (isComplexValue(l) || isComplexValue(r)) {
    const lc = toComplexValue(l);
    const rc = toComplexValue(r);
    return lc !== null && rc !== null && lc.real === rc.real && lc.imag === rc.imag;
  }
  if (typeof l === "string" && typeof r === "string") return l === r;
  return false;
}

function contractBinary(node: StepNode): ReduceResult | null {
  const left = node.left as StepNode;
  const right = node.right as StepNode;
  const op = node.operator as string;

  let result: StepNode | null = null;
  if (left.type === "Literal" && right.type === "Literal") {
    const l = left.value;
    const r = right.value;
    if (typeof l === "string" && typeof r === "string") {
      result = stringBinary(op, l, r);
    } else if (isComplexValue(l) || isComplexValue(r)) {
      // Any int/float/complex mix promotes to complex once either side is complex, exactly as the
      // real evaluator does — checked before the plain int/float branch below so e.g. `2 + (1+2j)`
      // (an int mixed with a complex) routes here instead of failing the `isNumericValue` check.
      const lc = toComplexValue(l);
      const rc = toComplexValue(r);
      if (lc !== null && rc !== null) result = complexBinary(op, lc, rc);
    } else if (isNumericValue(l) && isNumericValue(r)) {
      // If either operand is a `float`, the operation promotes to float (Python semantics), so
      // `3.14 * 0` is `0.0` and `1 == 1.0` is `True`. `bool` is deliberately excluded from
      // `isNumericValue` (see its definition), so `l`/`r` here are `int`/`float` only.
      if (typeof l !== "number" && typeof r !== "number") {
        result = intBinary(op, l, r);
      } else {
        const ln = typeof l === "number" ? l : Number(l);
        const rn = typeof r === "number" ? r : Number(r);
        result = floatBinary(op, ln, rn, true);
      }
    }
  }

  if (
    result === null &&
    (op === "==" || op === "!=") &&
    isResultValue(left) &&
    isResultValue(right)
  ) {
    // Structural equality over any x any at Python §1/§2 (see docs/specs/python_typing_middle_12.tex)
    // — pairs, `None`, and any cross-type combination the dispatch above does not resolve (e.g.
    // `1 == 'ab'`, `None == []`). `structuralEquals` itself throws (via `reportBinaryTypeError`) when
    // either operand — at the top level or nested inside a pair — is a `bool` or function value.
    const eq = structuralEquals(op, left, right);
    result = boolLiteral(op === "==" ? eq : !eq);
  }

  if (result === null) {
    // The operation did not apply. If both operands are concrete values and the combination is a
    // genuine Python error, report it (so the stepper shows the error before "Evaluation stuck");
    // otherwise — unmodelled-but-valid, or an operand not yet a value — leave it a graceful "stuck".
    reportBinaryTypeError(op, left, right);
    return null;
  }
  return {
    node: result,
    preRedex: node,
    postRedex: result,
    explanation: `Evaluated binary expression ${unparse(node)}`,
    beforeExplanation: `Evaluating binary expression ${unparse(node)}`,
  };
}

function contractUnary(node: StepNode): ReduceResult | null {
  const arg = node.argument as StepNode;
  const op = (node.operator as string).trim();
  let result: StepNode | null = null;
  if (op === "not") {
    // Unlike native Python's truthiness, `not` requires a genuine `bool` operand in this dialect
    // (matching the real evaluator's NOT instruction) — a non-bool value is a TypeError below, not a
    // truthy/falsy result.
    if (isBoolNode(arg)) {
      const value = !(arg.value as boolean);
      result = literal(value, value ? "True" : "False");
    }
  } else if (arg.type === "Literal" && typeof arg.value === "bigint") {
    if (op === "-") result = literal(-arg.value, String(-arg.value), false);
    else if (op === "+") result = literal(arg.value, String(arg.value), false);
  } else if (arg.type === "Literal" && typeof arg.value === "number") {
    if (op === "-") result = numberLiteral(-arg.value, Boolean(arg.pyFloat));
    else if (op === "+") result = numberLiteral(arg.value, Boolean(arg.pyFloat));
  } else if (arg.type === "Literal" && isComplexValue(arg.value)) {
    if (op === "-") result = complexLiteral({ real: -arg.value.real, imag: -arg.value.imag });
    else if (op === "+") result = complexLiteral(arg.value);
  }
  if (result === null) {
    if (op === "not") {
      // A non-bool *value* (e.g. `not 5`, `not None`, `not (lambda: ...)`) is a TypeError; an argument
      // not yet reduced to a value stays a graceful "stuck".
      if (!isStepperValue(arg)) return null;
      throw new Error(`TypeError: bad operand type for unary not: '${operandTypeName(arg)}'`);
    }
    // `-x` / `+x` on a non-numeric *value* is a Python TypeError (e.g. `-"a"`, `-None`); a non-value
    // argument stays a graceful "stuck".
    const t = valueTypeName(arg);
    if ((op === "-" || op === "+") && t !== null) {
      throw new Error(`TypeError: bad operand type for unary ${op}: '${t}'`);
    }
    return null;
  }
  const argRepr = unparse(arg);
  const explanation =
    op === "not"
      ? `Evaluated unary expression not ${argRepr}.`
      : op === "-"
        ? `Evaluated unary expression -${argRepr}`
        : `Evaluated unary expression ${unparse(node)}`;
  const beforeExplanation =
    op === "not"
      ? `Evaluating unary expression not ${argRepr}.`
      : op === "-"
        ? `Evaluating unary expression -${argRepr}.`
        : `Evaluating unary expression ${unparse(node)}`;
  return { node: result, preRedex: node, postRedex: result, explanation, beforeExplanation };
}

function contractLogical(node: StepNode): ReduceResult | null {
  const left = node.left as StepNode;
  const right = node.right as StepNode;
  const op = node.operator as string;
  if (!isBoolNode(left)) {
    // Unlike native Python's truthiness, `and`/`or` require a genuine `bool` left operand in this
    // dialect (matching the real evaluator's BOOL_OP instruction); the right operand's type is
    // unrestricted (it is only ever returned, never tested). A non-bool *value* is a TypeError; a left
    // side not yet reduced to a value (e.g. an unbound name) stays a graceful "stuck".
    if (!isStepperValue(left)) return null;
    throw new Error(`TypeError: unsupported operand type(s) for ${op}: '${operandTypeName(left)}'`);
  }
  const leftTruthy = left.value === true;
  const takeLeft = op === "and" ? !leftTruthy : leftTruthy;
  const chosen = clone(takeLeft ? left : right);
  const explanation =
    op === "and"
      ? leftTruthy
        ? "Evaluated AND expression, left of operator is truthy, will evaluate right of operator"
        : "Evaluated AND expression, left of operator is falsy, stop evaluation"
      : leftTruthy
        ? "Evaluated OR expression, left of operator is truthy, stop evaluation"
        : "Evaluated OR expression, left of operator is falsy, will evaluate right of operator";
  const beforeExplanation = op === "and" ? "Evaluating AND expression" : "Evaluating OR expression";
  return { node: chosen, preRedex: node, postRedex: chosen, explanation, beforeExplanation };
}

function contractConditional(node: StepNode): ReduceResult | null {
  const test = node.test as StepNode;
  if (!isBoolNode(test)) {
    // Unlike native Python's truthiness, a conditional expression's (`x if p else y`) condition
    // requires a genuine `bool` in this dialect. docs/specs/python_typing.tex:56-57 states this
    // explicitly for `if`/`elif` ("Following if and elif, Python §x only allows boolean
    // expressions"); docs/md/README_1.md and up present the conditional expression as the same
    // feature under that same heading, so its predicate is held to the identical rule here. A
    // non-bool *value* is a TypeError; a test not yet reduced to a value stays a graceful "stuck"
    // (matches `contractLogical`'s identical shape for `and`/`or`).
    if (!isStepperValue(test)) return null;
    throw new Error(
      `TypeError: conditional expression condition must be bool, not '${operandTypeName(test)}'`,
    );
  }
  const truthy = test.value === true;
  const chosen = clone((truthy ? node.consequent : node.alternate) as StepNode);
  const branch = truthy ? "consequent" : "alternate";
  return {
    node: chosen,
    preRedex: node,
    postRedex: chosen,
    explanation: `Evaluated conditional expression, condition is ${truthy ? "true" : "false"}, will evaluate ${branch}`,
    beforeExplanation: `Evaluating conditional expression`,
  };
}

/**
 * Fully reduces `fn(...args)` to a value — the substitution stepper's own answer to "a module calls
 * back into a Python function it was handed" (py-slang#423, e.g. `rune`'s `connect_ends` sampling a
 * Python-authored curve function). `fn` is already a Python-authored callable value
 * (`moduleInterop.ts`'s `isPythonCallable`); `args` are already-converted argument values, never
 * needing further reduction themselves.
 *
 * There is no separate "apply and get the result" primitive to reach for here, unlike CSE's
 * control/stash machine or py2js's compiled JS functions: the substitution model's *only* notion of
 * "run this to completion" is repeatedly contracting one step at a time until nothing's left to do,
 * exactly what the outer step sequence itself does (`getSteps.ts`'s `drive`) — so this is that same
 * `reduceExpr` loop, just scoped to one call expression instead of a whole program, and producing no
 * visible steps of its own (this call happens entirely *inside* one contraction of the outer
 * sequence, e.g. the module call this callback is answering). Deliberately unbounded, unlike the outer
 * sequence's own `contractionBudget`: a module calling back into a Python function can legitimately
 * need far more contractions than any reasonable *visible* step count would ever show a student — e.g.
 * `sound`'s `play` sampling a student-authored wave function at 44.1kHz needs tens of thousands of
 * callback calls to render even one second of audio (py-slang#427). A genuinely non-terminating
 * callback is the host's problem to stop, not this loop's: the evaluator runs inside its own Worker,
 * and the frontend's "Stop" control kills that Worker outright regardless of what it's doing
 * internally, same as it already does for a non-terminating top-level program. A thrown error (a
 * genuine Python-level fault, e.g. TypeError) propagates unchanged, surfacing exactly like any other
 * runtime fault inside a module call already does; a body that gets stuck without erroring (an unbound
 * name, say) has no valid partial outcome to hand back to the module either, so that's an error here
 * too, not a silent "stuck" the caller would have no way to represent.
 */
export async function applyPythonCallable(
  fn: StepNode,
  args: StepNode[],
  context: StepperContext,
): Promise<StepNode> {
  let current: StepNode = { type: "CallExpression", callee: fn, arguments: args };
  for (;;) {
    const step = await reduceExpr(current, context);
    if (step === null) break;
    // A print()/print_llist() call inside the callback's own body: this contraction's ReduceResult
    // is the only place that text ever appears, and it would otherwise be lost — the *outer*
    // contraction (the module call this callback is answering) never sets `output` itself, so
    // `drive`/`evaluatePython`'s normal "read the top-level ReduceResult's output" never sees it. See
    // `StepperContext.pendingOutput`'s doc comment.
    if (step.output !== undefined && context.pendingOutput !== undefined) {
      context.pendingOutput.text += step.output;
    }
    current = step.node;
  }
  if (!isValue(current)) {
    throw new Error("Evaluation stuck");
  }
  return current;
}

async function contractCall(node: StepNode, context: StepperContext): Promise<ReduceResult | null> {
  const callee = node.callee as StepNode;
  const args = node.arguments as StepNode[];

  // A built-in called by name (e.g. `abs(-5)`, `math_sqrt(2)`). Once every argument is a value,
  // contract the whole call to the computed result in one step, like Source's stepper. `applyBuiltin`
  // throws on misuse (wrong type/arity), which the driver turns into an "Evaluation stuck" step.
  if (callee.type === "Identifier" && isBuiltinFunctionName(String(callee.name))) {
    if (!args.every(isValue)) return null;
    const name = String(callee.name);
    const result = applyBuiltin(name, args);
    return {
      node: result,
      preRedex: node,
      postRedex: result,
      explanation: `Ran ${name}`,
      beforeExplanation: `Running ${name}`,
      // `print`/`print_llist` also write to the program's output; record that text so the driver can
      // show it in the stepper's output panel (from this call's "Ran ..." step onward). Both still
      // yield `None`, same as every other call here.
      output:
        name === "print"
          ? formatPrintOutput(args)
          : name === "print_llist"
            ? formatPrintLlistOutput(args)
            : undefined,
    };
  }

  // A function imported from a module (`from rune import circle`, py-slang#385) — see
  // `moduleInterop.ts`'s module doc comment for the scope this covers (no Python closure crossing
  // into the call) and why it can't be represented as an ordinary `applyBuiltin` name lookup (the
  // binding is per-program, substituted in by `getSteps.ts`'s `resolveImports`, not a fixed global
  // table). `context.evaluator` is only absent when no module loader is wired up at all (see
  // `resolveImports`'s doc comment), in which case no `ModuleFunction` node could exist in the tree
  // in the first place — this branch is unreachable then, not a silent no-op.
  if (isModuleFunctionNode(callee)) {
    if (!args.every(isValue)) return null;
    if (context.evaluator === undefined) {
      throw new Error(`NameError: name '${String(callee.name)}' is not defined`);
    }
    const sourceStart = node.sourceStart;
    const sourceEnd = node.sourceEnd;
    if (typeof sourceStart === "number" && typeof sourceEnd === "number") {
      (
        context.evaluator as typeof context.evaluator & {
          setCurrentCallLocation?: (start: number, end: number) => void;
        }
      ).setCurrentCallLocation?.(sourceStart, sourceEnd);
    }
    const name = String(callee.name);
    const minArgs = callee.minArgs as number;
    // Checked up front, like a static built-in's own `checkArity` call inside `applyBuiltin` — a
    // wrong-arity call gets a proper Python-style TypeError instead of whatever native error falls
    // out of spreading a mismatched argument list into the module's own closure.
    checkArity(name, args, minArgs, callee.isVararg ? null : minArgs);
    const result = await callModuleFunction(
      context.evaluator,
      callee.closure as TypedValue<DataType.CLOSURE>,
      name,
      args,
      (fn, callArgs) => applyPythonCallable(fn, callArgs, context),
    );
    return {
      node: result,
      preRedex: node,
      postRedex: result,
      explanation: `Ran ${name}`,
      beforeExplanation: `Running ${name}`,
    };
  }

  // `input([prompt])` (py-slang#191) — a genuine host round-trip (`context.requestInput`, backed by
  // `IRunnerPlugin.requestInput`), the interactive analogue of a module call: one real "ask the
  // student, wait for their answer" exchange per call, in program order — see `context.ts`'s doc
  // comment. Not a `BUILTIN_FUNCTIONS` entry (unlike every other static builtin) precisely because it
  // needs this extra capability rather than being purely a function of its arguments; recognised here
  // by name instead — see `isSpecialFormName`, also consulted by preprocessing (so the name resolves)
  // and by `is_function`/`arity`'s dispatch (so aliasing — `p = input; p()` — and introspection work
  // the same as every other builtin). `context.requestInput` is only absent when no host is wired up
  // (mirrors `context.evaluator` above), which — like a call to `time_time()`/`random_random()` — is
  // the one case this degrades to a graceful "Evaluation stuck" rather than a hard error: a program
  // using `input()` is always valid Python, so refusing to even *start* reducing it (the way a missing
  // module refuses to resolve) would be wrong; simply not being able to finish this one call is the
  // honest outcome, exactly like the other interactive builtins' documented degrade in `builtins.ts`.
  if (callee.type === "Identifier" && isSpecialFormName(String(callee.name))) {
    if (!args.every(isValue)) return null;
    if (context.requestInput === undefined) return null;
    checkArity("input", args, 0, 1);
    // Python's `input(prompt)` writes `str(prompt)` to stdout with no trailing newline (unlike
    // `print`, which always adds one — see `formatPrintOutput`) before blocking; `input()` with no
    // argument writes nothing at all.
    const promptText = args.length > 0 ? pyStr(args[0], false) : undefined;
    const answer = await context.requestInput(promptText);
    const result = stringLiteral(answer);
    return {
      node: result,
      preRedex: node,
      postRedex: result,
      explanation: `Ran input`,
      beforeExplanation: `Running input`,
      output: promptText,
    };
  }

  if (!isFunctionValue(callee)) {
    // A fully-reduced callee that is a value but not callable (`5(3)`, `None()`, `"s"()`) is a Python
    // TypeError; report it so the error shows before "Evaluation stuck" rather than a silent stuck. A
    // non-value callee (a leftover/unbound name) is not diagnosed here and stays a graceful "stuck".
    const t = valueTypeName(callee);
    if (t !== null) throw new Error(`TypeError: '${t}' object is not callable`);
    return null;
  }

  const params = paramNames(callee);
  if (params.length !== args.length) {
    // Too few / too many arguments for a user function is a Python TypeError. The wording mirrors the
    // built-ins' arity message (`checkArity` in ./builtins) for a consistent explanation box.
    const fname =
      callee.type === "FunctionDeclaration"
        ? String((callee.id as StepNode).name)
        : typeof callee.name === "string"
          ? callee.name
          : "<lambda>";
    throw new Error(
      `TypeError: ${fname}() takes ${params.length} argument(s) but ${args.length} were given`,
    );
  }

  // The body to reduce. A lambda's body is its expression. A `def`'s body is a block: when it begins
  // with a `return`, reduce straight to that argument (anything after it is dead code) — Source's fast
  // path; otherwise reduce the whole block as a *block expression* (`reduceBlock`), stepping through
  // any `if`/local bindings until a `return` exits with the function's value. Mirrors Source's
  // `StepperBlockExpression`, so multi-statement bodies (e.g. an `if/else` with `return`s) work.
  let body: StepNode;
  if (callee.type === "ArrowFunctionExpression") {
    body = callee.body as StepNode;
  } else {
    const stmts = (callee.body as StepNode).body as StepNode[];
    body =
      stmts.length >= 1 && stmts[0].type === "ReturnStatement" && stmts[0].argument != null
        ? (stmts[0].argument as StepNode)
        : { type: "BlockStatement", body: stmts };
  }

  let result = clone(body);
  // Bind the function's own name to itself in the body first, so recursive calls resolve (each one
  // stays a compact mu-term; expansion is bounded by the step limit, as in Source). A parameter of
  // the same name shadows it, so skip that case — and `substitute` never descends into the bound
  // copy's own parameter/name, so applying it later re-binds correctly without capture.
  const selfName =
    callee.type === "FunctionDeclaration"
      ? String((callee.id as StepNode).name)
      : typeof callee.name === "string"
        ? callee.name
        : undefined;
  if (selfName !== undefined && !params.includes(selfName)) {
    result = substitute(result, selfName, callee);
  }
  params.forEach((p, i) => {
    result = substitute(result, p, args[i]);
  });
  // Mirror Source's application explanation: a named function shows as its name, an anonymous lambda
  // as its full form (`unparse`), and a nullary call as "<func> runs".
  const functionDisplay = unparse(callee);
  const argsJoined = args.map(unparse).join(", ");
  const paramsJoined = params.join(", ");
  const explanation =
    params.length === 0
      ? `Ran ${functionDisplay}`
      : `Substituted ${argsJoined} into ${paramsJoined} of ${functionDisplay}`;
  const beforeExplanation =
    params.length === 0
      ? `Running ${functionDisplay}`
      : `Substituting ${argsJoined} into ${paramsJoined} of ${functionDisplay}`;
  return { node: result, preRedex: node, postRedex: result, explanation, beforeExplanation };
}

/* -------------------------------------------------------------------------- */
/*                          One-step expression reducer                       */
/* -------------------------------------------------------------------------- */

/** Rewraps `child`'s result one level up, into `parent[key]`. */
function rebuild(parent: StepNode, key: string, child: ReduceResult): ReduceResult {
  return { ...child, node: { ...parent, [key]: child.node } };
}

function rebuildIndex(
  parent: StepNode,
  key: string,
  index: number,
  child: ReduceResult,
): ReduceResult {
  const arr = (parent[key] as StepNode[]).slice();
  arr[index] = child.node;
  return { ...child, node: { ...parent, [key]: arr } };
}

/** Reduces `node` by a single step, or returns `null` if it is already a value / irreducible. */
export async function reduceExpr(
  node: StepNode,
  context: StepperContext,
): Promise<ReduceResult | null> {
  switch (node.type) {
    case "Identifier":
      // A leftover name is an atom: a built-in function name, or an unbound name that does not reduce
      // on its own. Built-in *constants* (math_pi, …) never reach here — they are substituted with
      // their value before stepping (see `substituteBuiltinConstants`), so they render as the value
      // from the first step rather than contracting mid-run.
      return null;
    case "BinaryExpression": {
      const left = await reduceExpr(node.left as StepNode, context);
      if (left) return rebuild(node, "left", left);
      const right = await reduceExpr(node.right as StepNode, context);
      if (right) return rebuild(node, "right", right);
      return contractBinary(node);
    }
    case "LogicalExpression": {
      const left = await reduceExpr(node.left as StepNode, context);
      if (left) return rebuild(node, "left", left);
      return contractLogical(node);
    }
    case "UnaryExpression": {
      const arg = await reduceExpr(node.argument as StepNode, context);
      if (arg) return rebuild(node, "argument", arg);
      return contractUnary(node);
    }
    case "ConditionalExpression": {
      const test = await reduceExpr(node.test as StepNode, context);
      if (test) return rebuild(node, "test", test);
      return contractConditional(node);
    }
    case "CallExpression": {
      const callee = await reduceExpr(node.callee as StepNode, context);
      if (callee) return rebuild(node, "callee", callee);
      const args = node.arguments as StepNode[];
      for (let i = 0; i < args.length; i++) {
        const reduced = await reduceExpr(args[i], context);
        if (reduced) return rebuildIndex(node, "arguments", i, reduced);
      }
      return contractCall(node, context);
    }
    case "ArrayExpression": {
      const elements = node.elements as StepNode[];
      for (let i = 0; i < elements.length; i++) {
        const reduced = await reduceExpr(elements[i], context);
        if (reduced) return rebuildIndex(node, "elements", i, reduced);
      }
      return null;
    }
    case "BlockStatement":
      // A function body in expression position (produced by applying a multi-statement `def`).
      return reduceBlock(node, context);
    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/*                          One-step program reducer                          */
/* -------------------------------------------------------------------------- */

function declaratorOf(stmt: StepNode): StepNode {
  return (stmt.declarations as StepNode[])[0];
}

/**
 * The outcome of trying to reduce a statement list's leading statement, shared by the `Program`
 * reducer and the block-expression reducer (a function body in expression position). The two contexts
 * differ only at the boundaries (what a leftover value statement / a `return` / running out of
 * statements means), so the per-statement work lives here once.
 */
type HeadOutcome =
  | {
      // The head (or a binding it introduces) was reduced one step; `newBody` is the resulting list.
      kind: "step";
      // The statement list the after step displays — always this same list, never `[head, ...]` — see
      // `ReduceResult.node`'s doc comment on the after == next-before invariant.
      newBody: StepNode[];
      preRedex: StepNode;
      // Unset when this step discards the *whole* head statement (a binding substituted away, a dropped
      // `pass`/import, an inlined `if` branch) — see `ReduceResult.postRedex`'s doc comment.
      postRedex?: StepNode;
      explanation: string;
      beforeExplanation: string;
      // Text this step writes to the program's output (only a `print(...)` reduced inside the head
      // produces any — see `ReduceResult.output`); propagated to the `ReduceResult` for the driver.
      output?: string;
      // Whether this step is a `breakpoint()` statement; propagated to `ReduceResult.isBreakpoint`.
      isBreakpoint?: boolean;
    }
  | { kind: "finished-expression" } // head is a fully-evaluated `ExpressionStatement` (a value)
  | { kind: "return" } //              head is a `ReturnStatement` (exits a function body)
  | { kind: "irreducible" }; //        head cannot be reduced and is not a value statement

/**
 * Performs the contraction common to both statement contexts on the leading statement: an unfinished
 * expression/initializer takes one expression step; a finished binding (assignment / function
 * definition) substitutes its value into the rest of the list; a finished `if` selects and inlines a
 * branch; a `pass` is dropped. Boundary cases (`finished-expression`/`return`/`irreducible`) are
 * reported back for the caller to resolve.
 */
async function stepHead(
  head: StepNode,
  rest: StepNode[],
  context: StepperContext,
): Promise<HeadOutcome> {
  switch (head.type) {
    case "ExpressionStatement": {
      const expr = head.expression as StepNode;
      // Python's `breakpoint()` is the stepper's analogue of JavaScript's `debugger;`: a no-op
      // statement (like `pass`) that also marks a step the host's breakpoint navigation (the
      // double-arrow) can jump to. Detected here against the *current*, already-substituted tree — a
      // call whose callee is (by now) literally the built-in identifier `breakpoint`, with every
      // argument already reduced to a value — instead of the student's original syntax, so it behaves
      // like every other built-in: reached directly (`breakpoint()`) or via aliasing
      // (`bp = breakpoint; bp()`) is indistinguishable, just as `p = print; p(1)` already is. Real
      // Python's `breakpoint(*args, **kws)` takes any number of arguments (forwarded to
      // sys.breakpointhook, which the CSE/stepper's own no-op `breakpoint` already ignores either way —
      // see stdlib/misc.ts), so this fires for any arity, not just zero — matching the point
      // `contractCall` below would otherwise apply the builtin at (args not yet all values still takes
      // an ordinary reduction step first, via `reduceExpr` below). This only matches when the call is
      // the *whole* of a bare statement; used any other way (`x = breakpoint()`, nested in a larger
      // expression, passed around) it falls through to `reduceExpr` below and reduces as an ordinary
      // built-in call yielding `None`, matching Python's real return value.
      if (
        expr.type === "CallExpression" &&
        (expr.callee as StepNode).type === "Identifier" &&
        (expr.callee as StepNode).name === "breakpoint" &&
        (expr.arguments as StepNode[]).every(isValue)
      ) {
        return {
          kind: "step",
          newBody: rest,
          preRedex: head,
          explanation: "Evaluated breakpoint statement",
          beforeExplanation: "Evaluating breakpoint statement",
          isBreakpoint: true,
        };
      }
      const reduced = await reduceExpr(expr, context);
      if (reduced) {
        // `hasBreakpoint: false` on the carried-forward copy: `head` still has one more expression
        // step to take, so it stays the head on the next call to this function with the *same*
        // `hasBreakpoint` flag (plain object spread) — clearing it here is what makes a gutter
        // breakpoint (see `headBreakpoint` in `reduceProgram`/`reduceBlock`) fire exactly once, on
        // this first step reaching the statement, rather than on every subsequent expression step
        // taken while still evaluating it.
        return {
          kind: "step",
          newBody: [{ ...head, expression: reduced.node, hasBreakpoint: false }, ...rest],
          preRedex: reduced.preRedex,
          postRedex: reduced.postRedex,
          explanation: reduced.explanation,
          beforeExplanation: reduced.beforeExplanation,
          output: reduced.output,
          isBreakpoint: reduced.isBreakpoint,
        };
      }
      // A finished expression statement is a value to discard (or the program's result); one that
      // cannot reduce and is *not* a value (e.g. `5(3)`, an unbound name) is stuck, not finished.
      return isStepperValue(expr) ? { kind: "finished-expression" } : { kind: "irreducible" };
    }
    case "VariableDeclaration": {
      const decl = declaratorOf(head);
      const init = decl.init as StepNode;
      if (!isValue(init)) {
        const reduced = await reduceExpr(init, context);
        if (reduced) {
          // See the identical `hasBreakpoint: false` note in the `ExpressionStatement` case above.
          return {
            kind: "step",
            newBody: [
              { ...head, declarations: [{ ...decl, init: reduced.node }], hasBreakpoint: false },
              ...rest,
            ],
            preRedex: reduced.preRedex,
            postRedex: reduced.postRedex,
            explanation: reduced.explanation,
            beforeExplanation: reduced.beforeExplanation,
            output: reduced.output,
            isBreakpoint: reduced.isBreakpoint,
          };
        }
        return { kind: "irreducible" };
      }
      // The initializer is a value: bind the name by substituting it into the rest of the list. Like a
      // `FunctionDeclaration` below, this has no value of its own to highlight on the after step (the
      // binding is gone, substituted into every use in `rest`) — see `ReduceResult.postRedex`'s doc
      // comment.
      const name = String((decl.id as StepNode).name);
      // Naming an (anonymous) function value makes its uses render as a mu-term `name`, like Source's
      // `const f = x => ...`; any other value is substituted unchanged.
      const boundValue: StepNode =
        init.type === "ArrowFunctionExpression" && init.name === undefined
          ? { ...init, name }
          : init;
      const substitutedRest = substituteRest(rest, name, boundValue);
      return {
        kind: "step",
        newBody: substitutedRest,
        preRedex: head,
        explanation: `Declared and substituted ${name} into the rest of the block`,
        beforeExplanation: `Declaring and substituting ${name} into the rest of the block`,
      };
    }
    case "FunctionDeclaration": {
      const name = String((head.id as StepNode).name);
      // Substitute the function as a *named value* (the `name` marker) so each use renders as a
      // mu-term `name` you hover to reveal the body, instead of expanding the body inline. The
      // declaration site keeps its full `def` form (it carries no `name` marker). Mirrors Source.
      const value: StepNode = { ...head, name };
      const substitutedRest = substituteRest(rest, name, value);
      return {
        kind: "step",
        newBody: substitutedRest,
        preRedex: head,
        explanation: `Declared and substituted ${name} into the rest of the block`,
        beforeExplanation: `Declaring and substituting ${name} into the rest of the block`,
      };
    }
    case "PassStatement":
      return {
        kind: "step",
        newBody: rest,
        preRedex: head,
        explanation: "Evaluated pass statement",
        beforeExplanation: "Evaluating pass statement",
      };
    case "ImportStatement": {
      // Like a def/assignment's own contraction above, not actually a no-op once an evaluator is
      // wired up: `moduleInterop.ts`'s `resolveImports` resolves every import's value ahead of
      // stepping but defers substituting it in until the corresponding import statement's own step is
      // reached (py-slang#417) — exactly here. `bindings` is absent (or empty) when no module loader
      // was available at all, in which case this genuinely is a no-op, matching the CSE machine's own
      // `FromImport` evaluator once its `evaluateImports` pass has run.
      const bindings = (head.bindings as ImportBinding[] | undefined) ?? [];
      let substitutedRest = rest;
      for (const { name, value } of bindings) {
        substitutedRest = substituteRest(substitutedRest, name, value);
      }
      return {
        kind: "step",
        newBody: substitutedRest,
        preRedex: head,
        explanation: "Evaluated import statement",
        beforeExplanation: "Evaluating import statement",
      };
    }
    case "IfStatement": {
      const reduced = await reduceExpr(head.test as StepNode, context);
      if (reduced) {
        // See the identical `hasBreakpoint: false` note in the `ExpressionStatement` case above.
        return {
          kind: "step",
          newBody: [{ ...head, test: reduced.node, hasBreakpoint: false }, ...rest],
          preRedex: reduced.preRedex,
          postRedex: reduced.postRedex,
          explanation: reduced.explanation,
          beforeExplanation: reduced.beforeExplanation,
          output: reduced.output,
          isBreakpoint: reduced.isBreakpoint,
        };
      }
      const test = head.test as StepNode;
      if (!isBoolNode(test)) {
        // Unlike native Python's truthiness, an `if`/`elif` condition requires a genuine `bool` in
        // this dialect (an `elif` is a nested `IfStatement` in `head.alternate`, so this one
        // check-site covers both). docs/specs/python_typing.tex:56-57: "Following if and elif,
        // Python §x only allows boolean expressions." A non-bool *value* is a TypeError; a test not
        // yet reduced to a value stays irreducible (matches `contractLogical`'s identical shape for
        // `and`/`or`).
        if (!isStepperValue(test)) return { kind: "irreducible" };
        throw new Error(`TypeError: if condition must be bool, not '${operandTypeName(test)}'`);
      }
      const truthy = test.value === true;
      const branch = (truthy ? head.consequent : head.alternate) as StepNode | null;
      const branchBody = branch ? (branch.body as StepNode[]) : [];
      const branchName = truthy ? "if" : "else";
      // The chosen branch is already inlined into `newBody` here, on this same step — the after step
      // shows the branch's statements in place, no separate lingering step needed (see
      // `ReduceResult.node`'s doc comment).
      return {
        kind: "step",
        newBody: [...branchBody, ...rest],
        preRedex: head,
        explanation: `Evaluated if statement, condition ${truthy ? "true" : "false"}, will proceed to ${branchName} block`,
        beforeExplanation: `Evaluating if statement`,
      };
    }
    case "ReturnStatement":
      return { kind: "return" };
    default:
      return { kind: "irreducible" };
  }
}

/**
 * Reduces a `Program` by a single step. Returns `null` when the program is in normal form — i.e. its
 * leading statement is a finished value statement that is last (the program's value), or nothing is
 * left to reduce.
 */
export async function reduceProgram(
  prog: StepNode,
  context: StepperContext = {},
): Promise<ReduceResult | null> {
  const body = prog.body as StepNode[];
  if (body.length === 0) return null;

  const head = body[0];
  const rest = body.slice(1);
  const outcome = await stepHead(head, rest, context);
  // A statement flagged by `markBreakpoints` (a gutter click resolved to its closest enclosing
  // statement — see `../../breakpoints.ts`, propagated onto the `StepNode` by `translate.ts`) is
  // treated exactly like an explicit `breakpoint()` call: computed once here, where `head` is in
  // scope, and OR'd into every `ReduceResult` this function can return for it, rather than
  // threading it through every `stepHead` arm individually.
  const headBreakpoint = !!head.hasBreakpoint;

  switch (outcome.kind) {
    case "step":
      return {
        node: { ...prog, body: outcome.newBody },
        preRedex: outcome.preRedex,
        postRedex: outcome.postRedex,
        explanation: outcome.explanation,
        beforeExplanation: outcome.beforeExplanation,
        output: outcome.output,
        isBreakpoint: outcome.isBreakpoint || headBreakpoint,
      };
    case "finished-expression": {
      // A fully-evaluated top-level expression statement is a value to discard — a Python statement
      // yields no program value (unlike Source/js-slang, whose final expression *is* the result). So we
      // drop it even when it is the last statement: the final line's value then disappears via the same
      // step as every other line's, and the run ends on an empty program that `drive` reports as
      // "Evaluation complete". (The REPL still echoes this value — captured in `evaluatePython`.) No
      // `postRedex`: the value leaves nothing behind to highlight, so the after step shows `rest` plain.
      const text = unparse(head.expression as StepNode);
      return {
        node: { ...prog, body: rest },
        preRedex: head,
        explanation: `Evaluated ${text}`,
        beforeExplanation: `Evaluating ${text}`,
        isBreakpoint: headBreakpoint,
      };
    }
    case "return": // A `return` at the top level is not valid Python; treat the program as done.
    case "irreducible":
      return null;
  }
}

/**
 * Reduces a *block expression* by a single step: a function body lifted into expression position by
 * applying a multi-statement `def` (see `contractCall`). It steps through its statements like a
 * program, except a leading `return` exits the function — the whole block contracts to the return's
 * argument expression (which then reduces in place) — and falling off the end yields Python `None`.
 * Mirrors Source's `StepperBlockExpression`.
 */
async function reduceBlock(node: StepNode, context: StepperContext): Promise<ReduceResult | null> {
  const none = (): StepNode => literal(null, "None");
  const fallOff = (preRedex: StepNode, isBreakpoint = false): ReduceResult => {
    const result = none();
    return {
      node: result,
      preRedex,
      postRedex: result,
      explanation: "Function returned None",
      beforeExplanation: "Function returning None",
      isBreakpoint,
    };
  };

  const body = node.body as StepNode[];
  if (body.length === 0) return fallOff(node); // empty body → None

  const head = body[0];
  const rest = body.slice(1);
  const outcome = await stepHead(head, rest, context);
  // See the identical `headBreakpoint` note in `reduceProgram`.
  const headBreakpoint = !!head.hasBreakpoint;

  switch (outcome.kind) {
    case "step":
      return {
        node: { ...node, body: outcome.newBody },
        preRedex: outcome.preRedex,
        postRedex: outcome.postRedex,
        explanation: outcome.explanation,
        beforeExplanation: outcome.beforeExplanation,
        output: outcome.output,
        isBreakpoint: outcome.isBreakpoint || headBreakpoint,
      };
    case "return": {
      // `return` exits the function: the block contracts to the return's argument (or `None` for a
      // bare `return`); the argument then reduces in place. Anything after it is dead code, dropped.
      const arg = (head.argument as StepNode | null) ?? none();
      return {
        node: arg,
        preRedex: head,
        postRedex: arg,
        explanation: `Returned ${unparse(arg)}`,
        beforeExplanation: `Returning ${unparse(arg)}`,
        isBreakpoint: headBreakpoint,
      };
    }
    case "finished-expression": {
      // A bare expression value in a function body is not the function's result: discard it; if it was
      // the last statement, the function fell off the end → None. As in `reduceProgram`'s
      // "finished-expression" case, no `postRedex`: the value leaves nothing behind to highlight.
      if (rest.length === 0) return fallOff(head, headBreakpoint);
      const text = unparse(head.expression as StepNode);
      return {
        node: { ...node, body: rest },
        preRedex: head,
        explanation: `Evaluated ${text}`,
        beforeExplanation: `Evaluating ${text}`,
        isBreakpoint: headBreakpoint,
      };
    }
    case "irreducible":
      // A statement in the body is stuck (cannot reduce and is not a value/return). Signal no
      // progress so the driver reports the whole evaluation as stuck, rather than inventing a value.
      return null;
  }
}
