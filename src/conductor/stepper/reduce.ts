/**
 * The substitution-model reducer for the Python stepper.
 *
 * Reduction is the standard small-step substitution model used by Source's stepper, adapted to the
 * estree-shaped {@link StepNode} tree:
 *  - expressions reduce leftmost-innermost (operands first, then the operator/application),
 *  - `and`/`or`/`if` short-circuit (only the controlling sub-expression is reduced eagerly),
 *  - applying a `lambda`/single-`return` `def` substitutes arguments for parameters in the body,
 *  - at the statement level, an assignment or function definition binds a name by substituting its
 *    value into the following statements (the substitution model's treatment of `const`).
 *
 * Each {@link reduceProgram} call performs exactly one contraction and reports the redex/result so
 * the driver can emit before/after markers. It returns `null` once the program is in normal form.
 *
 * Known limitations (acceptable for a teaching stepper): integers use JS `bigint` (exact, but large
 * exponents may be slow); float arithmetic uses JS `number` (IEEE 754); recursion is not supported
 * (it would expand without a fixpoint and is bounded only by the step limit); re-binding an
 * already-substituted name in a later statement is not tracked.
 */

import { type StepNode, clone, isFunctionValue, isValue, literal, unparse } from './ast';

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

function numberRepr(n: number, pyFloat: boolean): string {
  return pyFloat && Number.isInteger(n) ? `${n}.0` : String(n);
}

function numberLiteral(n: number, pyFloat: boolean): StepNode {
  return literal(n, numberRepr(n, pyFloat), pyFloat);
}

/** Python truthiness for the value subset the stepper handles. */
function isTruthy(node: StepNode): boolean {
  if (node.type === 'ArrayExpression') return (node.elements as StepNode[]).length > 0;
  if (node.type !== 'Literal') return true; // function values are truthy
  const v = node.value;
  if (v === null || v === false) return false;
  if (v === true) return true;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'bigint') return v !== 0n;
  if (typeof v === 'string') return v.length > 0;
  return true;
}

/* -------------------------------------------------------------------------- */
/*                               Substitution                                 */
/* -------------------------------------------------------------------------- */

function mapValue(value: unknown, fn: (node: StepNode) => StepNode): unknown {
  if (Array.isArray(value)) return value.map(v => mapValue(v, fn));
  if (value !== null && typeof value === 'object' && typeof (value as StepNode).type === 'string') {
    return fn(value as StepNode);
  }
  return value;
}

function mapChildren(node: StepNode, fn: (node: StepNode) => StepNode): StepNode {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(node)) out[key] = mapValue(node[key], fn);
  return out as StepNode;
}

function paramNames(node: StepNode): string[] {
  return ((node.params as StepNode[]) ?? []).map(p => String(p.name));
}

/**
 * Capture-avoiding-by-shadowing substitution of `name` with `value` throughout `node`. Substitution
 * does not descend into a function that binds `name` as a parameter (or, for a named `def`, as its
 * own name), so inner bindings correctly shadow the outer one.
 */
export function substitute(node: StepNode, name: string, value: StepNode): StepNode {
  switch (node.type) {
    case 'Identifier':
      return node.name === name ? clone(value) : node;
    case 'ArrowFunctionExpression':
      if (paramNames(node).includes(name)) return node;
      return { ...node, body: substitute(node.body as StepNode, name, value) };
    case 'FunctionDeclaration':
      if ((node.id as StepNode).name === name || paramNames(node).includes(name)) return node;
      return { ...node, body: substitute(node.body as StepNode, name, value) };
    case 'VariableDeclarator':
      return { ...node, init: substitute(node.init as StepNode, name, value) };
    default:
      return mapChildren(node, child => substitute(child, name, value));
  }
}

/* -------------------------------------------------------------------------- */
/*                          Expression contractions                           */
/* -------------------------------------------------------------------------- */

function contractBinary(node: StepNode): ReduceResult | null {
  const left = node.left as StepNode;
  const right = node.right as StepNode;
  if (left.type !== 'Literal' || right.type !== 'Literal') return null;
  const op = node.operator as string;
  const l = left.value;
  const r = right.value;

  let result: StepNode | null = null;
  if (op === '+' && typeof l === 'string' && typeof r === 'string') {
    result = literal(l + r, `'${l + r}'`);
  } else if (typeof l === 'bigint' && typeof r === 'bigint') {
    if (r === 0n && (op === '/' || op === '//' || op === '%')) {
      throw new Error('ZeroDivisionError: division by zero');
    }
    if (l === 0n && r < 0n && op === '**') {
      throw new Error('ZeroDivisionError: 0.0 cannot be raised to a negative power');
    }
    switch (op) {
      case '+': result = literal(l + r, String(l + r), false); break;
      case '-': result = literal(l - r, String(l - r), false); break;
      case '*': result = literal(l * r, String(l * r), false); break;
      case '/': result = numberLiteral(Number(l) / Number(r), true); break;
      case '//': {
        const q = l / r;
        const floored = l % r !== 0n && (l < 0n) !== (r < 0n) ? q - 1n : q;
        result = literal(floored, String(floored), false); break;
      }
      case '%': {
        const rem = ((l % r) + r) % r;
        result = literal(rem, String(rem), false); break;
      }
      case '**': {
        if (r < 0n) {
          result = numberLiteral(Number(l) ** Number(r), true);
        } else {
          const pw = l ** r;
          result = literal(pw, String(pw), false);
        }
        break;
      }
      case '<': result = literal(l < r, l < r ? 'True' : 'False'); break;
      case '>': result = literal(l > r, l > r ? 'True' : 'False'); break;
      case '<=': result = literal(l <= r, l <= r ? 'True' : 'False'); break;
      case '>=': result = literal(l >= r, l >= r ? 'True' : 'False'); break;
      case '==': result = literal(l === r, l === r ? 'True' : 'False'); break;
      case '!=': result = literal(l !== r, l !== r ? 'True' : 'False'); break;
      default: return null;
    }
  } else if (typeof l === 'number' && typeof r === 'number') {
    if (r === 0 && (op === '/' || op === '//' || op === '%')) {
      throw new Error('ZeroDivisionError: division by zero');
    }
    if (l === 0 && r < 0 && op === '**') {
      throw new Error('ZeroDivisionError: 0.0 cannot be raised to a negative power');
    }
    const pyFloat = Boolean(left.pyFloat) || Boolean(right.pyFloat) || op === '/';
    switch (op) {
      case '+': result = numberLiteral(l + r, pyFloat); break;
      case '-': result = numberLiteral(l - r, pyFloat); break;
      case '*': result = numberLiteral(l * r, pyFloat); break;
      case '/': result = numberLiteral(l / r, true); break;
      case '//': result = numberLiteral(Math.floor(l / r), pyFloat); break;
      case '%': result = numberLiteral(((l % r) + r) % r, pyFloat); break;
      case '**': result = numberLiteral(l ** r, pyFloat || l ** r !== Math.floor(l ** r)); break;
      case '<': result = literal(l < r, l < r ? 'True' : 'False'); break;
      case '>': result = literal(l > r, l > r ? 'True' : 'False'); break;
      case '<=': result = literal(l <= r, l <= r ? 'True' : 'False'); break;
      case '>=': result = literal(l >= r, l >= r ? 'True' : 'False'); break;
      case '==': result = literal(l === r, l === r ? 'True' : 'False'); break;
      case '!=': result = literal(l !== r, l !== r ? 'True' : 'False'); break;
      default: return null;
    }
  } else if (op === '==' || op === '!=') {
    const eq = l === r;
    result = literal(op === '==' ? eq : !eq, (op === '==' ? eq : !eq) ? 'True' : 'False');
  }

  if (result === null) return null;
  return {
    node: result,
    preRedex: node,
    postRedex: result,
    explanation: `${unparse(node)} evaluates to ${result.raw}`,
  };
}

function contractUnary(node: StepNode): ReduceResult | null {
  const arg = node.argument as StepNode;
  const op = (node.operator as string).trim();
  let result: StepNode | null = null;
  if (op === 'not') {
    const value = !isTruthy(arg);
    result = literal(value, value ? 'True' : 'False');
  } else if (arg.type === 'Literal' && typeof arg.value === 'bigint') {
    if (op === '-') result = literal(-arg.value, String(-arg.value), false);
    else if (op === '+') result = literal(arg.value, String(arg.value), false);
  } else if (arg.type === 'Literal' && typeof arg.value === 'number') {
    if (op === '-') result = numberLiteral(-arg.value, Boolean(arg.pyFloat));
    else if (op === '+') result = numberLiteral(arg.value, Boolean(arg.pyFloat));
  }
  if (result === null) return null;
  return {
    node: result,
    preRedex: node,
    postRedex: result,
    explanation: `${unparse(node)} evaluates to ${result.raw}`,
  };
}

function contractLogical(node: StepNode): ReduceResult {
  const left = node.left as StepNode;
  const right = node.right as StepNode;
  const op = node.operator as string;
  const leftTruthy = isTruthy(left);
  const takeLeft = op === 'and' ? !leftTruthy : leftTruthy;
  const chosen = clone(takeLeft ? left : right);
  return {
    node: chosen,
    preRedex: node,
    postRedex: chosen,
    explanation:
      op === 'and'
        ? `Left operand of \`and\` is ${leftTruthy ? 'truthy' : 'falsy'}, so the expression is the ${takeLeft ? 'left' : 'right'} operand`
        : `Left operand of \`or\` is ${leftTruthy ? 'truthy' : 'falsy'}, so the expression is the ${takeLeft ? 'left' : 'right'} operand`,
  };
}

function contractConditional(node: StepNode): ReduceResult {
  const truthy = isTruthy(node.test as StepNode);
  const chosen = clone((truthy ? node.consequent : node.alternate) as StepNode);
  return {
    node: chosen,
    preRedex: node,
    postRedex: chosen,
    explanation: `Predicate is ${truthy ? 'True' : 'False'}, so evaluate the ${truthy ? 'consequent' : 'alternative'}`,
  };
}

function contractCall(node: StepNode): ReduceResult | null {
  const callee = node.callee as StepNode;
  const args = node.arguments as StepNode[];
  if (!isFunctionValue(callee)) return null;

  const params = paramNames(callee);
  if (params.length !== args.length) return null;

  // The body to reduce: a lambda's body is its expression; a `def`'s body must be a single `return`.
  let body: StepNode;
  if (callee.type === 'ArrowFunctionExpression') {
    body = callee.body as StepNode;
  } else {
    const stmts = (callee.body as StepNode).body as StepNode[];
    if (stmts.length !== 1 || stmts[0].type !== 'ReturnStatement' || stmts[0].argument == null) {
      return null;
    }
    body = stmts[0].argument as StepNode;
  }

  let result = clone(body);
  params.forEach((p, i) => {
    result = substitute(result, p, args[i]);
  });
  return {
    node: result,
    preRedex: node,
    postRedex: result,
    explanation: `Apply ${unparse(callee)} to (${args.map(unparse).join(', ')})`,
  };
}

/* -------------------------------------------------------------------------- */
/*                          One-step expression reducer                       */
/* -------------------------------------------------------------------------- */

function rebuild(parent: StepNode, key: string, child: ReduceResult): ReduceResult {
  return { ...child, node: { ...parent, [key]: child.node } };
}

function rebuildIndex(parent: StepNode, key: string, index: number, child: ReduceResult): ReduceResult {
  const arr = (parent[key] as StepNode[]).slice();
  arr[index] = child.node;
  return { ...child, node: { ...parent, [key]: arr } };
}

/** Reduces `node` by a single step, or returns `null` if it is already a value / irreducible. */
export function reduceExpr(node: StepNode): ReduceResult | null {
  switch (node.type) {
    case 'BinaryExpression': {
      const left = reduceExpr(node.left as StepNode);
      if (left) return rebuild(node, 'left', left);
      const right = reduceExpr(node.right as StepNode);
      if (right) return rebuild(node, 'right', right);
      return contractBinary(node);
    }
    case 'LogicalExpression': {
      const left = reduceExpr(node.left as StepNode);
      if (left) return rebuild(node, 'left', left);
      return contractLogical(node);
    }
    case 'UnaryExpression': {
      const arg = reduceExpr(node.argument as StepNode);
      if (arg) return rebuild(node, 'argument', arg);
      return contractUnary(node);
    }
    case 'ConditionalExpression': {
      const test = reduceExpr(node.test as StepNode);
      if (test) return rebuild(node, 'test', test);
      return contractConditional(node);
    }
    case 'CallExpression': {
      const callee = reduceExpr(node.callee as StepNode);
      if (callee) return rebuild(node, 'callee', callee);
      const args = node.arguments as StepNode[];
      for (let i = 0; i < args.length; i++) {
        const reduced = reduceExpr(args[i]);
        if (reduced) return rebuildIndex(node, 'arguments', i, reduced);
      }
      return contractCall(node);
    }
    case 'ArrayExpression': {
      const elements = node.elements as StepNode[];
      for (let i = 0; i < elements.length; i++) {
        const reduced = reduceExpr(elements[i]);
        if (reduced) return rebuildIndex(node, 'elements', i, reduced);
      }
      return null;
    }
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
 * Reduces a `Program` by a single step. Processes the leading statement: an unfinished expression or
 * initializer takes one expression step; a finished binding (assignment / function definition)
 * substitutes its value into the rest of the program; a finished `if` selects a branch; a `pass`
 * statement is dropped; a leftover value statement is discarded. Returns `null` when the program is
 * in normal form.
 */
export function reduceProgram(prog: StepNode): ReduceResult | null {
  const body = prog.body as StepNode[];
  if (body.length === 0) return null;

  const head = body[0];
  const rest = body.slice(1);
  const withHead = (newHead: StepNode, result: Omit<ReduceResult, 'node'>): ReduceResult => ({
    ...result,
    node: { ...prog, body: [newHead, ...rest] },
  });
  const replaceWith = (newBody: StepNode[], result: Omit<ReduceResult, 'node'>): ReduceResult => ({
    ...result,
    node: { ...prog, body: newBody },
  });

  switch (head.type) {
    case 'ExpressionStatement': {
      const reduced = reduceExpr(head.expression as StepNode);
      if (reduced) {
        return withHead({ ...head, expression: reduced.node }, reduced);
      }
      // A fully-evaluated expression statement: it is the program's value only if it is last.
      if (rest.length === 0) return null;
      return replaceWith(rest, {
        preRedex: head,
        explanation: 'Discard the value of the expression statement',
      });
    }
    case 'VariableDeclaration': {
      const decl = declaratorOf(head);
      const init = decl.init as StepNode;
      if (!isValue(init)) {
        const reduced = reduceExpr(init);
        if (reduced) {
          const newDecl = { ...decl, init: reduced.node };
          return withHead({ ...head, declarations: [newDecl] }, reduced);
        }
        return null;
      }
      // The initializer is a value: bind the name by substituting it into the rest of the program.
      const name = String((decl.id as StepNode).name);
      const newBody = rest.map(stmt => substitute(stmt, name, init));
      return replaceWith(newBody, {
        preRedex: head,
        explanation: `Substitute ${name} with ${unparse(init)}`,
      });
    }
    case 'FunctionDeclaration': {
      const name = String((head.id as StepNode).name);
      const newBody = rest.map(stmt => substitute(stmt, name, head));
      return replaceWith(newBody, {
        preRedex: head,
        explanation: `Define ${name} and substitute it into the rest of the program`,
      });
    }
    case 'PassStatement':
      return rest.length === 0
        ? null
        : replaceWith(rest, { preRedex: head, explanation: 'pass: no-op' });
    case 'IfStatement': {
      const reduced = reduceExpr(head.test as StepNode);
      if (reduced) {
        return withHead({ ...head, test: reduced.node }, reduced);
      }
      const truthy = isTruthy(head.test as StepNode);
      const branch = (truthy ? head.consequent : head.alternate) as StepNode | null;
      const branchBody = branch ? (branch.body as StepNode[]) : [];
      return replaceWith([...branchBody, ...rest], {
        preRedex: head,
        explanation: `Condition is ${truthy ? 'True' : 'False'}, take the ${truthy ? 'if' : 'else'} branch`,
      });
    }
    default:
      // Unsupported leading statement: drop it if anything follows, otherwise we are done.
      if (rest.length === 0) return null;
      return replaceWith(rest, { preRedex: head, explanation: 'Skip statement' });
  }
}
