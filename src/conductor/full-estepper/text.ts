/**
 * Terms and values of the full e-stepper as Python-like text, for the explanations of the steps and
 * for the text form of a trace (tests, command line).
 */

import type { Labels } from "./store";
import {
  translateExpr,
  translateFunctionBody,
  translateStmts,
  type Expr,
  type Stmt,
} from "./terms";
import { repr, type PyValue } from "./values";

/** A value as it appears in a program: a heap object by its label, a function by its name. */
export function valueText(v: PyValue, labels: Labels): string {
  switch (v.type) {
    case "list":
      return labels.object(v.obj);
    case "function":
      return v.obj.src.kind === "FunctionDef" ? v.obj.name : labels.object(v.obj);
    default:
      return repr(v, new Set(), true);
  }
}

/** A value as a noun phrase, for explanations: `function object #2`, `list #5`, `100`. */
export function describeValue(v: PyValue, labels: Labels): string {
  if (v.type === "list") return `list ${labels.object(v.obj)}`;
  if (v.type === "function") return `function object ${labels.object(v.obj)}`;
  return valueText(v, labels);
}

const COMPARISONS = new Set(["==", "!=", "<", "<=", ">", ">=", "in", "not in", "is", "is not"]);
const BINARY_PRECEDENCE: Record<string, number> = {
  "|": 6,
  "^": 7,
  "&": 8,
  "<<": 9,
  ">>": 9,
  "+": 10,
  "-": 10,
  "*": 11,
  "/": 11,
  "//": 11,
  "%": 11,
  "**": 13,
};
const UNARY = 12;
const ATOM = 15;

function precedence(e: Expr): number {
  switch (e.k) {
    case "lambda":
      return 0;
    case "cond":
      return 1;
    case "bool":
      return e.op === "or" ? 2 : 3;
    case "unary":
      return e.op === "not" ? 4 : UNARY;
    case "bin":
      return COMPARISONS.has(e.op) ? 5 : (BINARY_PRECEDENCE[e.op] ?? 10);
    case "val":
      return (e.v.type === "int" && e.v.value < 0n) ||
        (e.v.type === "float" && (e.v.value < 0 || Object.is(e.v.value, -0)))
        ? UNARY
        : ATOM;
    default:
      return ATOM;
  }
}

export function exprText(e: Expr, labels: Labels, min = 0): string {
  const text = plainExprText(e, labels);
  return precedence(e) < min ? `(${text})` : text;
}

function plainExprText(e: Expr, labels: Labels): string {
  const sub = (x: Expr, min: number) => exprText(x, labels, min);
  switch (e.k) {
    case "val":
      return e.label ?? valueText(e.v, labels);
    case "name":
      return e.name;
    case "unary":
      return e.op === "not" ? `not ${sub(e.arg, 4)}` : `${e.op}${sub(e.arg, UNARY)}`;
    case "bin": {
      if (COMPARISONS.has(e.op)) return `${sub(e.left, 6)} ${e.op} ${sub(e.right, 6)}`;
      const p = BINARY_PRECEDENCE[e.op] ?? 10;
      return e.op === "**"
        ? `${sub(e.left, p + 1)} ** ${sub(e.right, UNARY)}`
        : `${sub(e.left, p)} ${e.op} ${sub(e.right, p + 1)}`;
    }
    case "bool": {
      const p = e.op === "or" ? 2 : 3;
      return `${sub(e.left, p)} ${e.op} ${sub(e.right, p + 1)}`;
    }
    case "cond":
      return `${sub(e.cons, 2)} if ${sub(e.test, 2)} else ${sub(e.alt, 1)}`;
    case "lambda": {
      const params = e.src.parameters.map(p => p.lexeme).join(", ");
      const body = exprText(translateExpr(e.src.body), labels, 0);
      return params ? `lambda ${params}: ${body}` : `lambda: ${body}`;
    }
    case "call":
      return `${sub(e.callee, ATOM)}(${e.args.map(a => sub(a, 1)).join(", ")})`;
    case "list":
      return `[${e.elems.map(x => sub(x, 1)).join(", ")}]`;
    case "sub":
      return `${sub(e.obj, ATOM)}[${sub(e.index, 0)}]`;
    case "block":
      return `⟦${labels.frame(e.frame)}: ${stmtsText(e.body, labels)}⟧`;
    case "unsupported":
      return `<unsupported: ${e.what}>`;
  }
}

function blockText(body: Stmt[], labels: Labels): string {
  return body.length === 0 ? "{ }" : `{ ${stmtsText(body, labels)} }`;
}

export function stmtsText(list: Stmt[], labels: Labels): string {
  return list.map(s => stmtText(s, labels)).join("; ");
}

export function stmtText(s: Stmt, labels: Labels): string {
  const e = (x: Expr, min = 0) => exprText(x, labels, min);
  switch (s.k) {
    case "expr":
      return e(s.e);
    case "assign":
      return `${s.name} = ${e(s.e)}`;
    case "subassign":
      return `${e(s.obj, ATOM)}[${e(s.index)}] = ${e(s.e)}`;
    case "augassign":
      return `${s.name} ${s.op}= ${e(s.e)}`;
    case "augsub":
      return `${e(s.obj, ATOM)}[${e(s.index)}] ${s.op}= ${e(s.e)}`;
    case "if":
      return `if ${e(s.test)}: ${blockText(s.cons, labels)}${
        s.alt ? ` else: ${blockText(s.alt, labels)}` : ""
      }`;
    case "while":
      return `while ${e(translateExpr(s.src.condition))}: ${blockText(translateStmts(s.src.body), labels)}`;
    case "forinit":
      return `for ${s.target} in ${e(s.iter)}: ${blockText(translateStmts(s.src.body), labels)}`;
    case "for": {
      const source = valueText(s.source, labels);
      return `for ${s.target} in ${s.pos > 0 ? `${source}[${s.pos}:]` : source}: ${blockText(
        translateStmts(s.src.body),
        labels,
      )}`;
    }
    case "loop":
      return `${stmtsText(s.body, labels)}${s.body.length > 0 ? "; " : ""}${stmtText(s.next, labels)}`;
    case "def": {
      const params = s.src.parameters.map(p => p.lexeme).join(", ");
      return `def ${s.src.name.lexeme}(${params}): ${blockText(translateFunctionBody(s.src), labels)}`;
    }
    case "return":
      return s.e ? `return ${e(s.e)}` : "return";
    case "pass":
    case "break":
    case "continue":
      return s.k;
    case "global":
    case "nonlocal":
      return `${s.k} ${s.names.join(", ")}`;
    case "unsupported":
      return `<unsupported: ${s.what}>`;
  }
}
