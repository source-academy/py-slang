/**
 * Static scoping of Python, which decides where a name lives: in a function body, a name is local if
 * the body assigns it (or it is a parameter), unless `global` or `nonlocal` says otherwise; every
 * other name is looked up in the enclosing functions, then in the module, then in the built-ins.
 * (The e-stepper for Python §3/§4 gets this from the CSE machine; the full e-stepper does its own.)
 */

import { ExprNS, StmtNS } from "../../ast-types";
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
  const walk = (stmts: StmtNS.Stmt[], inFunction: boolean, inLoop: boolean): void => {
    for (const stmt of stmts) {
      if (stmt instanceof StmtNS.Return && !inFunction) {
        throw new PyError("SyntaxError", "'return' outside function");
      } else if (stmt instanceof StmtNS.Break && !inLoop) {
        throw new PyError("SyntaxError", "'break' outside loop");
      } else if (stmt instanceof StmtNS.Continue && !inLoop) {
        throw new PyError("SyntaxError", "'continue' not properly in loop");
      } else if (stmt instanceof StmtNS.If) {
        walk(stmt.body, inFunction, inLoop);
        if (stmt.elseBlock) walk(stmt.elseBlock, inFunction, inLoop);
      } else if (stmt instanceof StmtNS.While || stmt instanceof StmtNS.For) {
        walk(stmt.body, inFunction, true);
      } else if (stmt instanceof StmtNS.FunctionDef) {
        walk(stmt.body, true, false);
      }
    }
  };
  walk(program, false, false);
}
