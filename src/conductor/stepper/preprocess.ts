/**
 * Static pre-checks run before the stepper is allowed to start.
 *
 * Python reports an undefined name as a runtime `NameError`, but a substitution stepper has no global
 * environment to fault against mid-reduction — a free name simply stops reducing. So, like Source's
 * `checkProgramForUndefinedVariables`, we detect undefined variables up front as a *preprocessing*
 * error: the evaluator reports it and does not run the stepper at all (see `PyStepperEvaluator`).
 *
 * The check is a lexical scope walk over the translated {@link StepNode} tree. A name resolves if it
 * is a built-in (function or constant), or is bound — as an assignment, a `def`, an `if`-branch
 * binding, or a parameter — in the current function scope or any enclosing scope (Python hoists
 * assignments to function/module scope, so order within a scope does not matter for definedness).
 */

import type { StmtNS } from "../../ast-types";
import type { StepNode } from "./ast";
import { isBuiltinConstantName, isBuiltinFunctionName } from "./builtins";
import { translateProgram } from "./translate";

/** A real Python identifier (so translation's `<Unsupported>` placeholders are ignored). */
const IDENTIFIER = /^[A-Za-z_]\w*$/;

function paramNames(fn: StepNode): string[] {
  return ((fn.params as StepNode[]) ?? []).map(p => String(p.name));
}

/**
 * Names bound directly at one scope level by `statements` — assignments, `def`s, and bindings inside
 * `if`/`else` branches (which do not introduce a scope in Python) — without descending into nested
 * function bodies (those are inner scopes of their own).
 */
function collectBindings(statements: StepNode[], into: Set<string>): void {
  for (const stmt of statements) {
    switch (stmt.type) {
      case "VariableDeclaration":
        for (const d of stmt.declarations as StepNode[]) into.add(String((d.id as StepNode).name));
        break;
      case "FunctionDeclaration":
        into.add(String((stmt.id as StepNode).name));
        break;
      case "IfStatement": {
        const cons = stmt.consequent as StepNode | null;
        const alt = stmt.alternate as StepNode | null;
        if (cons) collectBindings(cons.body as StepNode[], into);
        if (alt) collectBindings(alt.body as StepNode[], into);
        break;
      }
      default:
        break;
    }
  }
}

const isDefined = (name: string, scopes: Set<string>[]): boolean =>
  isBuiltinFunctionName(name) || isBuiltinConstantName(name) || scopes.some(s => s.has(name));

/** Walks `program` (already translated) and returns the first undefined name, or `null` if all
 * referenced names resolve. */
export function findUndefinedName(program: StepNode): string | null {
  let found: string | null = null;

  const visit = (node: StepNode, scopes: Set<string>[]): void => {
    if (found !== null) return;
    switch (node.type) {
      case "Identifier": {
        const name = String(node.name);
        if (IDENTIFIER.test(name) && !isDefined(name, scopes)) found = name;
        return;
      }
      case "VariableDeclarator":
        // `id` is a binding, not a reference; only the initializer contains references.
        visit(node.init as StepNode, scopes);
        return;
      case "FunctionDeclaration": {
        // `id` and params are bindings; the body opens a new scope (params + its own bindings).
        const inner = new Set<string>(paramNames(node));
        collectBindings((node.body as StepNode).body as StepNode[], inner);
        visit(node.body as StepNode, [...scopes, inner]);
        return;
      }
      case "ArrowFunctionExpression": {
        // A lambda's body is a single expression; its only new bindings are the parameters.
        visit(node.body as StepNode, [...scopes, new Set<string>(paramNames(node))]);
        return;
      }
      default:
        for (const key of Object.keys(node)) {
          if (key === "type") continue;
          visitValue(node[key], scopes);
        }
    }
  };

  const visitValue = (value: unknown, scopes: Set<string>[]): void => {
    if (found !== null) return;
    if (Array.isArray(value)) {
      value.forEach(v => visitValue(v, scopes));
    } else if (
      value !== null &&
      typeof value === "object" &&
      typeof (value as StepNode).type === "string"
    ) {
      visit(value as StepNode, scopes);
    }
  };

  const moduleScope = new Set<string>();
  collectBindings(program.body as StepNode[], moduleScope);
  for (const stmt of program.body as StepNode[]) visit(stmt, [moduleScope]);
  return found;
}

/**
 * Comparison operators Python accepts but the substitution stepper does not model: identity (`is`,
 * `is not`) and membership (`in`, `not in`). They parse fine, but the reducer has no rule for them,
 * so a program using one would otherwise silently get "stuck" mid-reduction. We reject them up front
 * as a preprocessing error instead — mirroring Source's `noUnspecifiedOperator` rule.
 */
const UNSUPPORTED_OPERATORS = new Set(["is", "is not", "in", "not in"]);

/** Walks `program` (already translated) and returns the first unsupported operator used (see
 * {@link UNSUPPORTED_OPERATORS}), or `null` if none appears. */
export function findUnsupportedOperator(program: StepNode): string | null {
  let found: string | null = null;

  const visit = (value: unknown): void => {
    if (found !== null) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (
      value !== null &&
      typeof value === "object" &&
      typeof (value as StepNode).type === "string"
    ) {
      const node = value as StepNode;
      if (node.type === "BinaryExpression" && UNSUPPORTED_OPERATORS.has(String(node.operator))) {
        found = String(node.operator);
        return;
      }
      for (const key of Object.keys(node)) {
        if (key === "type") continue;
        visit(node[key]);
      }
    }
  };

  visit(program);
  return found;
}

/**
 * The stepper's preprocessing pass for a parsed Python program: returns an error message if it must
 * not run — an unsupported operator (`is`/`is not`/`in`/`not in`) or an undefined variable — or
 * `null` if it is clear to step.
 */
export function preprocessPython(fileInput: StmtNS.FileInput): string | null {
  const program = translateProgram(fileInput);

  const operator = findUnsupportedOperator(program);
  if (operator !== null) return `Operator '${operator}' is not allowed.`;

  const name = findUndefinedName(program);
  return name === null ? null : `NameError: name '${name}' is not defined`;
}
