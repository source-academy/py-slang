/**
 * Renders e-stepper terms and values as Python-like text: for step explanations and for the CLI's
 * text mode (`yarn repl --engine estepper`). The web plugin renders the serialized AST instead.
 */

import { StmtNS } from "../../ast-types";
import type { Closure } from "../../engines/cse/closure";
import type { Value } from "../../engines/cse/stash";
import { toPythonString } from "../../stdlib/utils";
import type { Labels } from "./labels";
import { translateStmts, type Expr, type Stmt } from "./terms";

/** Whether a function object was defined by the library prelude rather than by the program. */
export type IsLibraryClosure = (closure: Closure) => boolean;

export interface TextContext {
  labels: Labels;
  isLibrary: IsLibraryClosure;
}

export function functionName(closure: Closure): string | undefined {
  return closure.node.kind === "FunctionDef" ? closure.node.name.lexeme : undefined;
}

export function valueText(v: Value, tc: TextContext): string {
  switch (v.type) {
    case "list":
      return tc.labels.object(v);
    case "closure": {
      const name = functionName(v.closure);
      if (tc.isLibrary(v.closure)) return name ?? "lambda";
      return name ?? tc.labels.object(v.closure);
    }
    case "builtin":
      return v.name;
    default:
      return toPythonString(v, true);
  }
}

/** A value as a noun phrase, for explanations: `function object #2`, `list #5`, `100`. */
export function describeValue(v: Value, tc: TextContext): string {
  if (v.type === "list") return `list ${tc.labels.object(v)}`;
  if (v.type === "closure" && !tc.isLibrary(v.closure)) {
    return `function object ${tc.labels.object(v.closure)}`;
  }
  return valueText(v, tc);
}

const PRECEDENCE: Record<string, number> = {
  or: 2,
  and: 4,
  not: 5,
  "==": 8,
  "!=": 8,
  "<": 9,
  ">": 9,
  "<=": 9,
  ">=": 9,
  is: 9,
  "is not": 9,
  "+": 11,
  "-": 11,
  "*": 12,
  "/": 12,
  "//": 12,
  "%": 12,
  "**": 13,
};

function precedence(e: Expr): number {
  switch (e.k) {
    case "bin":
    case "bool":
      return PRECEDENCE[e.opText] ?? 10;
    case "unary":
      return e.opText === "not" ? 5 : 14;
    case "cond":
      return 1;
    case "lambda":
      return 0;
    default:
      return 20;
  }
}

function wrap(e: Expr, min: number, tc: TextContext): string {
  const text = exprText(e, tc);
  return precedence(e) < min ? `(${text})` : text;
}

export function exprText(e: Expr, tc: TextContext): string {
  switch (e.k) {
    case "val":
      return valueText(e.v, tc);
    case "name":
      return e.name;
    case "bin":
    case "bool": {
      const p = precedence(e);
      // `**` is right-associative; everything else here is left-associative.
      const rightAssoc = e.opText === "**";
      return `${wrap(e.left, rightAssoc ? p + 1 : p, tc)} ${e.opText} ${wrap(e.right, rightAssoc ? p : p + 1, tc)}`;
    }
    case "unary":
      return e.opText === "not" ? `not ${wrap(e.arg, 5, tc)}` : `${e.opText}${wrap(e.arg, 14, tc)}`;
    case "cond":
      return `${wrap(e.cons, 2, tc)} if ${wrap(e.test, 2, tc)} else ${wrap(e.alt, 1, tc)}`;
    case "lambda": {
      const params = e.src.parameters.map(p => (p.isStarred ? "*" : "") + p.lexeme).join(", ");
      return params ? `lambda ${params}: …` : "lambda: …";
    }
    case "call":
      return `${wrap(e.callee, 20, tc)}(${e.args
        .map((a, i) => (e.starred[i] ? "*" : "") + exprText(a, tc))
        .join(", ")})`;
    case "list":
      return `[${e.elems.map(x => exprText(x, tc)).join(", ")}]`;
    case "sub":
      return `${wrap(e.obj, 20, tc)}[${exprText(e.index, tc)}]`;
    case "block":
      return `⟦${e.fname} in ${tc.labels.frame(e.env)}⟧`;
    case "unsupported":
      return `<${e.what}>`;
  }
}

/** The first line of a statement (for explanations): `x = 1`, `while x < 3:`, … */
export function stmtHeadText(s: Stmt, tc: TextContext): string {
  switch (s.k) {
    case "expr":
      return exprText(s.e, tc);
    case "assign":
      return `${s.name} = ${exprText(s.value, tc)}`;
    case "subassign":
      return `${wrap(s.obj, 20, tc)}[${exprText(s.index, tc)}] = ${exprText(s.value, tc)}`;
    case "def":
      return `def ${s.src.name.lexeme}(${s.src.parameters
        .map(p => (p.isStarred ? "*" : "") + p.lexeme)
        .join(", ")}):`;
    case "return":
      return s.e ? `return ${exprText(s.e, tc)}` : "return";
    case "if":
      return `if ${exprText(s.test, tc)}:`;
    case "while":
      return `while ${exprText(s.test, tc)}:`;
    case "forinit":
      return `for ${s.src.target.lexeme} in range(${s.args.map(a => exprText(a, tc)).join(", ")}):`;
    case "for":
      return `for ${s.src.target.lexeme} in range(${s.cur}, ${s.end}, ${s.step}):`;
    case "loop":
      return s.body.length > 0 ? stmtHeadText(s.body[0], tc) : stmtHeadText(s.next, tc);
    case "break":
    case "continue":
    case "pass":
      return s.k;
    case "global":
    case "nonlocal":
      return `${s.k} ${s.names.join(", ")}`;
    case "unsupported-stmt":
      return `<${s.what}>`;
  }
}

/** A whole statement list as indented Python-like text (the CLI's text mode). */
export function stmtsText(stmts: Stmt[], tc: TextContext, indent = ""): string[] {
  const lines: string[] = [];
  for (const s of stmts) lines.push(...stmtText(s, tc, indent));
  return lines;
}

function sourceBlock(stmts: StmtNS.Stmt[], tc: TextContext, indent: string): string[] {
  // Loop and function bodies are kept as source until they run; show them via a fresh translation.
  return stmtsText(translateStmts(stmts), tc, indent);
}

function stmtText(s: Stmt, tc: TextContext, indent: string): string[] {
  const inner = indent + "    ";
  switch (s.k) {
    case "def":
      return [indent + stmtHeadText(s, tc), ...sourceBlock(s.src.body, tc, inner)];
    case "if": {
      const lines = [indent + stmtHeadText(s, tc), ...stmtsText(s.cons, tc, inner)];
      if (s.alt) lines.push(indent + "else:", ...stmtsText(s.alt, tc, inner));
      return lines;
    }
    case "while":
    case "forinit":
    case "for":
      return [indent + stmtHeadText(s, tc), ...sourceBlock(s.src.body, tc, inner)];
    case "loop":
      return [...stmtsText(s.body, tc, indent), ...stmtText(s.next, tc, indent)];
    default:
      return [indent + stmtHeadText(s, tc)];
  }
}
