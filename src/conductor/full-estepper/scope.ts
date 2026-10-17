/**
 * Static scoping of Python, which decides where a name lives: in a function body, a name is local if
 * the body assigns it (or it is a parameter), unless `global` or `nonlocal` says otherwise; every
 * other name is looked up in the enclosing functions, then in the module, then in the built-ins.
 * (The e-stepper for Python §3/§4 gets this from the CSE machine; the full e-stepper does its own.)
 */

import { ExprNS, StmtNS } from "../../ast-types";
import { traverseAST } from "../../validator/traverse";
import { PyError } from "./errors";
import type { ScopeInfo } from "./values";

const cache = new WeakMap<object, ScopeInfo>();

/** The scope of the body of a `def` or a `lambda`. */
export function scopeOf(src: StmtNS.FunctionDef | ExprNS.Lambda): ScopeInfo {
  const known = cache.get(src);
  if (known) return known;
  const globals = new Set<string>();
  const nonlocals = new Set<string>();
  const assigned = new Set<string>();
  if (src instanceof StmtNS.FunctionDef) collect(src.body, assigned, globals, nonlocals);
  const locals = new Set<string>(src.parameters.map(p => p.lexeme));
  for (const name of assigned) locals.add(name);
  for (const name of globals) locals.delete(name);
  for (const name of nonlocals) locals.delete(name);
  const info = { locals, globals, nonlocals };
  cache.set(src, info);
  return info;
}

/** Collects the names that a statement list binds, without looking into nested functions. */
function collect(
  body: StmtNS.Stmt[],
  assigned: Set<string>,
  globals: Set<string>,
  nonlocals: Set<string>,
): void {
  for (const stmt of body) {
    if (stmt instanceof StmtNS.Assign) {
      if (stmt.target instanceof ExprNS.Variable) assigned.add(stmt.target.name.lexeme);
    } else if (stmt instanceof StmtNS.AugAssign) {
      if (stmt.target instanceof ExprNS.Variable) assigned.add(stmt.target.name.lexeme);
    } else if (stmt instanceof StmtNS.For) {
      assigned.add(stmt.target.lexeme);
      collect(stmt.body, assigned, globals, nonlocals);
    } else if (stmt instanceof StmtNS.FunctionDef) {
      assigned.add(stmt.name.lexeme);
    } else if (stmt instanceof StmtNS.If) {
      collect(stmt.body, assigned, globals, nonlocals);
      if (stmt.elseBlock) collect(stmt.elseBlock, assigned, globals, nonlocals);
    } else if (stmt instanceof StmtNS.While) {
      collect(stmt.body, assigned, globals, nonlocals);
    } else if (stmt instanceof StmtNS.Global) {
      for (const n of stmt.names) globals.add(n.lexeme);
    } else if (stmt instanceof StmtNS.NonLocal) {
      for (const n of stmt.names) nonlocals.add(n.lexeme);
    }
  }
}

/**
 * The errors that CPython reports when it compiles the program, before it runs anything: a `return`
 * outside a function, `break` and `continue` outside a loop. Throws the first one.
 */
export function checkProgram(program: StmtNS.Stmt[]): void {
  // `enclosing` has the scopes of the functions around the statements, innermost last.
  const walk = (stmts: StmtNS.Stmt[], enclosing: ScopeInfo[], inLoop: boolean): void => {
    const inFunction = enclosing.length > 0;
    for (const stmt of stmts) {
      if (stmt instanceof StmtNS.Return && !inFunction) {
        throw new PyError("SyntaxError", "'return' outside function");
      } else if (stmt instanceof StmtNS.Break && !inLoop) {
        throw new PyError("SyntaxError", "'break' outside loop");
      } else if (stmt instanceof StmtNS.Continue && !inLoop) {
        throw new PyError("SyntaxError", "'continue' not properly in loop");
      } else if (stmt instanceof StmtNS.NonLocal && !inFunction) {
        throw new PyError("SyntaxError", "nonlocal declaration not allowed at module level");
      } else if (stmt instanceof StmtNS.If) {
        walk(stmt.body, enclosing, inLoop);
        if (stmt.elseBlock) walk(stmt.elseBlock, enclosing, inLoop);
      } else if (stmt instanceof StmtNS.While || stmt instanceof StmtNS.For) {
        walk(stmt.body, enclosing, true);
      } else if (stmt instanceof StmtNS.FunctionDef) {
        const scope = scopeOf(stmt);
        checkDeclarations(stmt, scope, enclosing);
        walk(stmt.body, [...enclosing, scope], false);
      }
    }
  };
  walk(program, [], false);
  checkOrder(program, new Map());
}

/**
 * `global` and `nonlocal` must come before the name is used or bound in their scope; CPython
 * reports it when it compiles. `seen` has the names of the scope so far (parameters, and what the
 * statements before bound or used), and says whether the name was bound ("assigned") or only used.
 */
function checkOrder(stmts: StmtNS.Stmt[], seen: Map<string, "assigned" | "used">): void {
  const use = (node: unknown): void => {
    if (!node) return;
    // Names in the body of a lambda belong to the lambda's scope.
    const inner = new Set<unknown>();
    traverseAST(node as never, n => {
      if (n instanceof ExprNS.Lambda || n instanceof ExprNS.MultiLambda) {
        traverseAST(n, d => d !== n && inner.add(d));
      } else if (n instanceof ExprNS.Variable && !inner.has(n) && !seen.has(n.name.lexeme)) {
        seen.set(n.name.lexeme, "used");
      }
    });
  };
  const bind = (name: string): void => void seen.set(name, "assigned");
  for (const stmt of stmts) {
    if (stmt instanceof StmtNS.Global || stmt instanceof StmtNS.NonLocal) {
      const word = stmt instanceof StmtNS.Global ? "global" : "nonlocal";
      for (const n of stmt.names) {
        const how = seen.get(n.lexeme);
        if (how === "assigned") {
          throw new PyError(
            "SyntaxError",
            `name '${n.lexeme}' is assigned to before ${word} declaration`,
          );
        }
        if (how === "used") {
          throw new PyError(
            "SyntaxError",
            `name '${n.lexeme}' is used prior to ${word} declaration`,
          );
        }
      }
    } else if (stmt instanceof StmtNS.Assign || stmt instanceof StmtNS.AugAssign) {
      use(stmt.value);
      if (stmt.target instanceof ExprNS.Variable) {
        if (stmt instanceof StmtNS.AugAssign) use(stmt.target);
        bind(stmt.target.name.lexeme);
      } else use(stmt.target);
    } else if (stmt instanceof StmtNS.If) {
      use(stmt.condition);
      checkOrder(stmt.body, seen);
      if (stmt.elseBlock) checkOrder(stmt.elseBlock, seen);
    } else if (stmt instanceof StmtNS.While) {
      use(stmt.condition);
      checkOrder(stmt.body, seen);
    } else if (stmt instanceof StmtNS.For) {
      use(stmt.iter);
      bind(stmt.target.lexeme);
      checkOrder(stmt.body, seen);
    } else if (stmt instanceof StmtNS.FunctionDef) {
      for (const p of stmt.parameters) use(p.default);
      bind(stmt.name.lexeme);
      checkOrder(stmt.body, new Map(stmt.parameters.map(p => [p.lexeme, "assigned" as const])));
    } else if (stmt instanceof StmtNS.Return) {
      use(stmt.value);
    } else if (stmt instanceof StmtNS.SimpleExpr) {
      use(stmt.expression);
    }
  }
}

/** The errors in the `global` and `nonlocal` declarations of a function, which CPython reports at compile time. */
function checkDeclarations(fn: StmtNS.FunctionDef, scope: ScopeInfo, enclosing: ScopeInfo[]): void {
  const params = new Set(fn.parameters.map(p => p.lexeme));
  for (const name of scope.globals) {
    if (params.has(name))
      throw new PyError("SyntaxError", `name '${name}' is parameter and global`);
    if (scope.nonlocals.has(name)) {
      throw new PyError("SyntaxError", `name '${name}' is nonlocal and global`);
    }
  }
  for (const name of scope.nonlocals) {
    if (params.has(name)) {
      throw new PyError("SyntaxError", `name '${name}' is parameter and nonlocal`);
    }
    // The nearest enclosing function that binds the name decides; one that declares it global
    // hides the functions around it.
    let found = false;
    for (let i = enclosing.length - 1; i >= 0; i--) {
      if (enclosing[i].globals.has(name)) break;
      if (enclosing[i].locals.has(name)) {
        found = true;
        break;
      }
    }
    if (!found) throw new PyError("SyntaxError", `no binding for nonlocal '${name}' found`);
  }
}
