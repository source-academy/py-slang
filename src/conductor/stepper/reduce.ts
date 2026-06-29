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

import {
  type StepNode,
  clone,
  isFunctionValue,
  isValue,
  literal,
  numberLiteral,
  paramNames,
  stringLiteral,
  substitute,
  unparse,
} from "./ast";
import {
  applyBuiltin,
  getBuiltinConstant,
  isBuiltinConstantName,
  isBuiltinFunctionName,
  isStepperValue,
} from "./builtins";

export interface ReduceResult {
  /** The program/expression after this single contraction. */
  node: StepNode;
  /** The node in the *before* tree that was contracted (highlighted before the step). */
  preRedex: StepNode;
  /** The node in the *after* tree that is the contraction's result (highlighted after the step). */
  postRedex?: StepNode;
  /** A human-readable description of the contraction. */
  explanation: string;
}

/* -------------------------------------------------------------------------- */
/*                          Values & Python semantics                         */
/* -------------------------------------------------------------------------- */

/** Python truthiness for the value subset the stepper handles. */
function isTruthy(node: StepNode): boolean {
  if (node.type === "ArrayExpression") return (node.elements as StepNode[]).length > 0;
  if (node.type !== "Literal") return true; // function values are truthy
  const v = node.value;
  if (v === null || v === false) return false;
  if (v === true) return true;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "bigint") return v !== 0n;
  if (typeof v === "string") return v.length > 0;
  return true;
}

/* -------------------------------------------------------------------------- */
/*                          Expression contractions                           */
/* -------------------------------------------------------------------------- */

const boolLiteral = (b: boolean): StepNode => literal(b, b ? "True" : "False");

/** A JS value that is a Python numeric (int = `bigint`, float = `number`, or `bool`). */
function isNumericValue(v: unknown): v is bigint | number | boolean {
  return typeof v === "bigint" || typeof v === "number" || typeof v === "boolean";
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

const toBig = (v: bigint | boolean): bigint => (typeof v === "boolean" ? (v ? 1n : 0n) : v);

const ARITHMETIC_OPS = new Set(["+", "-", "*", "/", "//", "%", "**"]);
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
  }
  if (isFunctionValue(node)) return "function";
  return null;
}

/**
 * Throws a Python `TypeError` for a binary operation that produced no result because its operand types
 * are genuinely unsupported (e.g. `1 + "a"`, `None < 2`, a function in arithmetic). The driver turns
 * the throw into an error step before "Evaluation stuck", exactly as it already does for
 * `ZeroDivisionError`. Combinations Python *does* allow but this teaching stepper simply does not model
 * — `str * int` repetition, `str % …` formatting, `str`-vs-`str` ordering, and anything on pairs/lists
 * — are left as a silent "stuck" instead, so a valid operation is never mislabelled as an error.
 */
function reportBinaryTypeError(op: string, left: StepNode, right: StepNode): void {
  const lt = valueTypeName(left);
  const rt = valueTypeName(right);
  if (lt === null || rt === null) return;
  const order = ORDER_OPS.has(op);
  if (!ARITHMETIC_OPS.has(op) && !order) return; // `==`/`!=` are defined for all values

  const intish = (t: string): boolean => t === "int" || t === "bool";
  if (op === "*" && ((lt === "str" && intish(rt)) || (intish(lt) && rt === "str"))) return; // repeat
  if (op === "%" && lt === "str") return; // %-formatting
  if (order && lt === "str" && rt === "str") return; // lexicographic string ordering is valid

  throw new Error(
    order
      ? `TypeError: '${op}' not supported between instances of '${lt}' and '${rt}'`
      : `TypeError: unsupported operand type(s) for ${op}: '${lt}' and '${rt}'`,
  );
}

function contractBinary(node: StepNode): ReduceResult | null {
  const left = node.left as StepNode;
  const right = node.right as StepNode;
  const op = node.operator as string;

  let result: StepNode | null = null;
  if (left.type === "Literal" && right.type === "Literal") {
    const l = left.value;
    const r = right.value;
    if (op === "+" && typeof l === "string" && typeof r === "string") {
      result = stringLiteral(l + r);
    } else if (isNumericValue(l) && isNumericValue(r)) {
      // A `bool` counts as an `int`; if either operand is a `float`, the operation promotes to float
      // (Python semantics), so `3.14 * 0` is `0.0` and `1 == 1.0` is `True`.
      if (typeof l !== "number" && typeof r !== "number") {
        result = intBinary(op, toBig(l), toBig(r));
      } else {
        const ln = typeof l === "number" ? l : Number(toBig(l));
        const rn = typeof r === "number" ? r : Number(toBig(r));
        result = floatBinary(op, ln, rn, true);
      }
    } else if (op === "==" || op === "!=") {
      const eq = l === r;
      result = boolLiteral(op === "==" ? eq : !eq);
    }
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
    explanation: `Binary expression ${unparse(node)} evaluated`,
  };
}

function contractUnary(node: StepNode): ReduceResult | null {
  const arg = node.argument as StepNode;
  const op = (node.operator as string).trim();
  let result: StepNode | null = null;
  if (op === "not") {
    const value = !isTruthy(arg);
    result = literal(value, value ? "True" : "False");
  } else if (arg.type === "Literal" && typeof arg.value === "bigint") {
    if (op === "-") result = literal(-arg.value, String(-arg.value), false);
    else if (op === "+") result = literal(arg.value, String(arg.value), false);
  } else if (arg.type === "Literal" && typeof arg.value === "number") {
    if (op === "-") result = numberLiteral(-arg.value, Boolean(arg.pyFloat));
    else if (op === "+") result = numberLiteral(arg.value, Boolean(arg.pyFloat));
  }
  if (result === null) {
    // `-x` / `+x` on a non-numeric *value* is a Python TypeError (e.g. `-"a"`, `-None`); `not` always
    // applies (truthiness), and a non-value argument stays a graceful "stuck".
    const t = valueTypeName(arg);
    if ((op === "-" || op === "+") && t !== null) {
      throw new Error(`TypeError: bad operand type for unary ${op}: '${t}'`);
    }
    return null;
  }
  const argRepr = unparse(arg);
  const explanation =
    op === "not"
      ? `Unary expression evaluated, boolean ${argRepr} negated.`
      : op === "-"
        ? `Unary expression evaluated, value ${argRepr} negated.`
        : `Unary expression ${unparse(node)} evaluated`;
  return { node: result, preRedex: node, postRedex: result, explanation };
}

function contractLogical(node: StepNode): ReduceResult {
  const left = node.left as StepNode;
  const right = node.right as StepNode;
  const op = node.operator as string;
  const leftTruthy = isTruthy(left);
  const takeLeft = op === "and" ? !leftTruthy : leftTruthy;
  const chosen = clone(takeLeft ? left : right);
  const explanation =
    op === "and"
      ? leftTruthy
        ? "AND operation evaluated, left of operator is truthy, continue evaluating right of operator"
        : "AND operation evaluated, left of operator is falsy, stop evaluation"
      : leftTruthy
        ? "OR operation evaluated, left of operator is truthy, stop evaluation"
        : "OR operation evaluated, left of operator is falsy, continue evaluating right of operator";
  return { node: chosen, preRedex: node, postRedex: chosen, explanation };
}

function contractConditional(node: StepNode): ReduceResult {
  const truthy = isTruthy(node.test as StepNode);
  const chosen = clone((truthy ? node.consequent : node.alternate) as StepNode);
  return {
    node: chosen,
    preRedex: node,
    postRedex: chosen,
    explanation: `Conditional expression evaluated, condition is ${truthy ? "true" : "false"}, ${truthy ? "consequent" : "alternate"} evaluated`,
  };
}

function contractCall(node: StepNode): ReduceResult | null {
  const callee = node.callee as StepNode;
  const args = node.arguments as StepNode[];

  // A built-in called by name (e.g. `abs(-5)`, `math_sqrt(2)`). Once every argument is a value,
  // contract the whole call to the computed result in one step, like Source's stepper. `applyBuiltin`
  // throws on misuse (wrong type/arity), which the driver turns into an "Evaluation stuck" step.
  if (callee.type === "Identifier" && isBuiltinFunctionName(String(callee.name))) {
    if (!args.every(isValue)) return null;
    const result = applyBuiltin(String(callee.name), args);
    return {
      node: result,
      preRedex: node,
      postRedex: result,
      explanation: `${String(callee.name)} runs`,
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
  const explanation =
    params.length === 0
      ? `${functionDisplay} runs`
      : `${args.map(unparse).join(", ")} substituted into ${params.join(", ")} of ${functionDisplay}`;
  return { node: result, preRedex: node, postRedex: result, explanation };
}

/* -------------------------------------------------------------------------- */
/*                          One-step expression reducer                       */
/* -------------------------------------------------------------------------- */

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
export function reduceExpr(node: StepNode): ReduceResult | null {
  switch (node.type) {
    case "Identifier": {
      // A leftover name is either a built-in constant (reduce to its value) or an atom (a built-in
      // function name / an unbound name) that does not reduce on its own.
      const name = String(node.name);
      if (isBuiltinConstantName(name)) {
        const value = getBuiltinConstant(name);
        return {
          node: value,
          preRedex: node,
          postRedex: value,
          explanation: `${name} is ${unparse(value)}`,
        };
      }
      return null;
    }
    case "BinaryExpression": {
      const left = reduceExpr(node.left as StepNode);
      if (left) return rebuild(node, "left", left);
      const right = reduceExpr(node.right as StepNode);
      if (right) return rebuild(node, "right", right);
      return contractBinary(node);
    }
    case "LogicalExpression": {
      const left = reduceExpr(node.left as StepNode);
      if (left) return rebuild(node, "left", left);
      return contractLogical(node);
    }
    case "UnaryExpression": {
      const arg = reduceExpr(node.argument as StepNode);
      if (arg) return rebuild(node, "argument", arg);
      return contractUnary(node);
    }
    case "ConditionalExpression": {
      const test = reduceExpr(node.test as StepNode);
      if (test) return rebuild(node, "test", test);
      return contractConditional(node);
    }
    case "CallExpression": {
      const callee = reduceExpr(node.callee as StepNode);
      if (callee) return rebuild(node, "callee", callee);
      const args = node.arguments as StepNode[];
      for (let i = 0; i < args.length; i++) {
        const reduced = reduceExpr(args[i]);
        if (reduced) return rebuildIndex(node, "arguments", i, reduced);
      }
      return contractCall(node);
    }
    case "ArrayExpression": {
      const elements = node.elements as StepNode[];
      for (let i = 0; i < elements.length; i++) {
        const reduced = reduceExpr(elements[i]);
        if (reduced) return rebuildIndex(node, "elements", i, reduced);
      }
      return null;
    }
    case "BlockStatement":
      // A function body in expression position (produced by applying a multi-statement `def`).
      return reduceBlock(node);
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
      newBody: StepNode[];
      preRedex: StepNode;
      postRedex?: StepNode;
      explanation: string;
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
function stepHead(head: StepNode, rest: StepNode[]): HeadOutcome {
  switch (head.type) {
    case "ExpressionStatement": {
      const expr = head.expression as StepNode;
      const reduced = reduceExpr(expr);
      if (reduced) {
        return {
          kind: "step",
          newBody: [{ ...head, expression: reduced.node }, ...rest],
          preRedex: reduced.preRedex,
          postRedex: reduced.postRedex,
          explanation: reduced.explanation,
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
        const reduced = reduceExpr(init);
        if (reduced) {
          return {
            kind: "step",
            newBody: [{ ...head, declarations: [{ ...decl, init: reduced.node }] }, ...rest],
            preRedex: reduced.preRedex,
            postRedex: reduced.postRedex,
            explanation: reduced.explanation,
          };
        }
        return { kind: "irreducible" };
      }
      // The initializer is a value: bind the name by substituting it into the rest of the list.
      const name = String((decl.id as StepNode).name);
      // Naming an (anonymous) function value makes its uses render as a mu-term `name`, like Source's
      // `const f = x => ...`; any other value is substituted unchanged.
      const boundValue: StepNode =
        init.type === "ArrowFunctionExpression" && init.name === undefined
          ? { ...init, name }
          : init;
      return {
        kind: "step",
        newBody: rest.map(stmt => substitute(stmt, name, boundValue)),
        preRedex: head,
        explanation: `${name} declared and substituted into the rest of the program`,
      };
    }
    case "FunctionDeclaration": {
      const name = String((head.id as StepNode).name);
      // Substitute the function as a *named value* (the `name` marker) so each use renders as a
      // mu-term `name` you hover to reveal the body, instead of expanding the body inline. The
      // declaration site keeps its full `def` form (it carries no `name` marker). Mirrors Source.
      const value: StepNode = { ...head, name };
      const params = paramNames(head);
      return {
        kind: "step",
        newBody: rest.map(stmt => substitute(stmt, name, value)),
        preRedex: head,
        explanation: params.length
          ? `Function ${name} declared, parameter(s) ${params.join(", ")} required`
          : `Function ${name} declared`,
      };
    }
    case "PassStatement":
      return {
        kind: "step",
        newBody: rest,
        preRedex: head,
        explanation: "Pass statement evaluated",
      };
    case "IfStatement": {
      const reduced = reduceExpr(head.test as StepNode);
      if (reduced) {
        return {
          kind: "step",
          newBody: [{ ...head, test: reduced.node }, ...rest],
          preRedex: reduced.preRedex,
          postRedex: reduced.postRedex,
          explanation: reduced.explanation,
        };
      }
      const truthy = isTruthy(head.test as StepNode);
      const branch = (truthy ? head.consequent : head.alternate) as StepNode | null;
      const branchBody = branch ? (branch.body as StepNode[]) : [];
      return {
        kind: "step",
        newBody: [...branchBody, ...rest],
        preRedex: head,
        explanation: `If statement evaluated, condition ${truthy ? "true" : "false"}, proceed to ${truthy ? "if" : "else"} block`,
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
export function reduceProgram(prog: StepNode): ReduceResult | null {
  const body = prog.body as StepNode[];
  if (body.length === 0) return null;

  const head = body[0];
  const rest = body.slice(1);
  const outcome = stepHead(head, rest);

  switch (outcome.kind) {
    case "step":
      return {
        node: { ...prog, body: outcome.newBody },
        preRedex: outcome.preRedex,
        postRedex: outcome.postRedex,
        explanation: outcome.explanation,
      };
    case "finished-expression":
      // A fully-evaluated expression statement: it is the program's value only if it is last.
      if (rest.length === 0) return null;
      return {
        node: { ...prog, body: rest },
        preRedex: head,
        explanation: `${unparse(head.expression as StepNode)} finished evaluating`,
      };
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
function reduceBlock(node: StepNode): ReduceResult | null {
  const none = (): StepNode => literal(null, "None");
  const fallOff = (preRedex: StepNode): ReduceResult => {
    const result = none();
    return { node: result, preRedex, postRedex: result, explanation: "Function returns None" };
  };

  const body = node.body as StepNode[];
  if (body.length === 0) return fallOff(node); // empty body → None

  const head = body[0];
  const rest = body.slice(1);
  const outcome = stepHead(head, rest);

  switch (outcome.kind) {
    case "step":
      return {
        node: { ...node, body: outcome.newBody },
        preRedex: outcome.preRedex,
        postRedex: outcome.postRedex,
        explanation: outcome.explanation,
      };
    case "return": {
      // `return` exits the function: the block contracts to the return's argument (or `None` for a
      // bare `return`); the argument then reduces in place. Anything after it is dead code, dropped.
      const arg = (head.argument as StepNode | null) ?? none();
      return { node: arg, preRedex: head, postRedex: arg, explanation: `${unparse(arg)} returned` };
    }
    case "finished-expression":
      // A bare expression value in a function body is not the function's result: discard it; if it
      // was the last statement, the function fell off the end → None.
      return rest.length === 0
        ? fallOff(head)
        : {
            node: { ...node, body: rest },
            preRedex: head,
            explanation: `${unparse(head.expression as StepNode)} finished evaluating`,
          };
    case "irreducible":
      // A statement in the body is stuck (cannot reduce and is not a value/return). Signal no
      // progress so the driver reports the whole evaluation as stuck, rather than inventing a value.
      return null;
  }
}
