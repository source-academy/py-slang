/**
 * The program terms that the full e-stepper rewrites: the program's syntax tree, in which the part
 * that has been evaluated is replaced by values, a function body under evaluation is a {@link BlockExpr}
 * that carries the frame it runs in, and a loop in progress is a {@link LoopStmt}. Terms are
 * immutable: a reduction builds a new tree and shares what did not change.
 *
 * Constructs that the engine does not implement yet are translated to `unsupported` terms, which
 * stop the evaluation with an error when they are reached.
 */

import { ExprNS, StmtNS } from "../../ast-types";
import { FALSE, NONE, TRUE, float, int, str, type Frame, type PyValue } from "./values";

export type Expr =
  /** A value; `label` is how it reads in the program, for a built-in that has been loaded already. */
  | { k: "val"; v: PyValue; label?: string }
  | { k: "name"; name: string }
  | { k: "unary"; op: string; arg: Expr }
  /** Arithmetic, comparison, membership and identity operators: both operands are evaluated. */
  | { k: "bin"; op: string; left: Expr; right: Expr }
  /** `and` / `or`: only the left operand is evaluated before the operator contracts. */
  | { k: "bool"; op: "and" | "or"; left: Expr; right: Expr }
  | { k: "cond"; test: Expr; cons: Expr; alt: Expr }
  | { k: "lambda"; src: ExprNS.Lambda }
  | { k: "call"; callee: Expr; args: Expr[] }
  | { k: "list"; elems: Expr[] }
  | { k: "sub"; obj: Expr; index: Expr }
  /** A function body under evaluation in `frame`. Contracts to the function's result. */
  | { k: "block"; frame: Frame; fname: string; body: Stmt[] }
  | { k: "unsupported"; what: string };

export type Stmt =
  | { k: "expr"; e: Expr }
  | { k: "assign"; name: string; e: Expr }
  | { k: "subassign"; obj: Expr; index: Expr; e: Expr }
  /** `name op= e`: `read` is the name, evaluated first, as Python does. */
  | { k: "augassign"; name: string; op: string; read: Expr; e: Expr }
  | { k: "augsub"; obj: Expr; index: Expr; op: string; e: Expr; old?: PyValue }
  /** An `if` statement; also what a `while` loop unfolds to (`loop` is true then). */
  | { k: "if"; test: Expr; cons: Stmt[]; alt: Stmt[] | null; loop: boolean }
  | { k: "while"; src: StmtNS.While }
  /** `for target in iter`, while `iter` is evaluated. */
  | { k: "forinit"; target: string; iter: Expr; src: StmtNS.For }
  /** `for target in …` over `source`, about to take its `pos`th element. */
  | { k: "for"; target: string; source: PyValue; pos: number; src: StmtNS.For }
  /** One iteration of a loop in progress: the rest of its body, then the loop (`next`) itself. */
  | { k: "loop"; body: Stmt[]; next: Stmt }
  | { k: "def"; src: StmtNS.FunctionDef }
  | { k: "return"; e: Expr | null }
  | { k: "pass" }
  | { k: "break" }
  | { k: "continue" }
  | { k: "global" | "nonlocal"; names: string[] }
  | { k: "unsupported"; what: string };

export const val = (v: PyValue): Expr => ({ k: "val", v });

/** What the engine cannot do with a parameter list yet; undefined if it can. */
function unsupportedParameters(params: ExprNS.Lambda["parameters"]): string | undefined {
  if (params.some(p => p.default)) return "default values of parameters";
  if (params.some(p => p.isStarred)) return "*args parameters";
  if (params.some(p => p.isDoubleStarred)) return "**kwargs parameters";
  return undefined;
}

const NODE_NAMES: Record<string, string> = {
  Tuple: "tuples",
  Dict: "dictionaries",
  Set: "set displays",
  Comprehension: "comprehensions",
  Slice: "slices",
  Attribute: "attribute access",
  CompareChain: "chained comparisons",
  Yield: "yield",
  Keyword: "keyword arguments",
  Starred: "unpacking with *",
  DoubleStarred: "unpacking with **",
  Complex: "complex numbers",
  MultiLambda: "multi-line lambda expressions",
};

export function translateExpr(e: ExprNS.Expr): Expr {
  if (e instanceof ExprNS.BigIntLiteral) return val(int(BigInt(e.value)));
  if (e instanceof ExprNS.Literal) {
    if (typeof e.value === "boolean") return val(e.value ? TRUE : FALSE);
    if (typeof e.value === "number") return val(float(e.value));
    return val(str(e.value));
  }
  if (e instanceof ExprNS.None) return val(NONE);
  if (e instanceof ExprNS.Variable) return { k: "name", name: e.name.lexeme };
  if (e instanceof ExprNS.Grouping) return translateExpr(e.expression);
  if (e instanceof ExprNS.Unary) {
    return { k: "unary", op: e.operator.lexeme, arg: translateExpr(e.right) };
  }
  if (e instanceof ExprNS.Binary || e instanceof ExprNS.Compare) {
    return {
      k: "bin",
      op: e.operator.lexeme,
      left: translateExpr(e.left),
      right: translateExpr(e.right),
    };
  }
  if (e instanceof ExprNS.BoolOp) {
    return {
      k: "bool",
      op: e.operator.lexeme === "and" ? "and" : "or",
      left: translateExpr(e.left),
      right: translateExpr(e.right),
    };
  }
  if (e instanceof ExprNS.Ternary) {
    return {
      k: "cond",
      test: translateExpr(e.predicate),
      cons: translateExpr(e.consequent),
      alt: translateExpr(e.alternative),
    };
  }
  if (e instanceof ExprNS.Lambda) {
    const what = unsupportedParameters(e.parameters);
    return what ? { k: "unsupported", what } : { k: "lambda", src: e };
  }
  if (e instanceof ExprNS.Call) {
    const odd = e.args.find(a => a instanceof ExprNS.Keyword || a instanceof ExprNS.Starred);
    if (odd) return { k: "unsupported", what: NODE_NAMES[odd.kind] ?? "this argument" };
    return { k: "call", callee: translateExpr(e.callee), args: e.args.map(translateExpr) };
  }
  if (e instanceof ExprNS.List) {
    const odd = e.elements.find(a => a instanceof ExprNS.Starred);
    if (odd) return { k: "unsupported", what: NODE_NAMES.Starred };
    return { k: "list", elems: e.elements.map(translateExpr) };
  }
  if (e instanceof ExprNS.Subscript) {
    if (e.index instanceof ExprNS.Slice) return { k: "unsupported", what: NODE_NAMES.Slice };
    return { k: "sub", obj: translateExpr(e.value), index: translateExpr(e.index) };
  }
  return { k: "unsupported", what: NODE_NAMES[e.kind] ?? e.kind };
}

export function translateStmts(body: StmtNS.Stmt[]): Stmt[] {
  return body.map(translateStmt);
}

/** The statement list of a function: a `def`'s body, or `return e` for a lambda's body `e`. */
export function translateFunctionBody(src: StmtNS.FunctionDef | ExprNS.Lambda): Stmt[] {
  return src instanceof StmtNS.FunctionDef
    ? translateStmts(src.body)
    : [{ k: "return", e: translateExpr(src.body) }];
}

export function translateStmt(s: StmtNS.Stmt): Stmt {
  if (s instanceof StmtNS.SimpleExpr) return { k: "expr", e: translateExpr(s.expression) };
  if (s instanceof StmtNS.Assign) {
    if (s.target instanceof ExprNS.Variable) {
      return { k: "assign", name: s.target.name.lexeme, e: translateExpr(s.value) };
    }
    if (s.target.index instanceof ExprNS.Slice) return { k: "unsupported", what: "slices" };
    return {
      k: "subassign",
      obj: translateExpr(s.target.value),
      index: translateExpr(s.target.index),
      e: translateExpr(s.value),
    };
  }
  if (s instanceof StmtNS.AugAssign) {
    const op = s.operator.lexeme.slice(0, -1);
    if (s.target instanceof ExprNS.Variable) {
      const name = s.target.name.lexeme;
      return { k: "augassign", name, op, read: { k: "name", name }, e: translateExpr(s.value) };
    }
    if (s.target instanceof ExprNS.Subscript && !(s.target.index instanceof ExprNS.Slice)) {
      return {
        k: "augsub",
        obj: translateExpr(s.target.value),
        index: translateExpr(s.target.index),
        op,
        e: translateExpr(s.value),
      };
    }
    return { k: "unsupported", what: "augmented assignment to this target" };
  }
  if (s instanceof StmtNS.If) {
    return {
      k: "if",
      test: translateExpr(s.condition),
      cons: translateStmts(s.body),
      alt: s.elseBlock ? translateStmts(s.elseBlock) : null,
      loop: false,
    };
  }
  if (s instanceof StmtNS.While) return { k: "while", src: s };
  if (s instanceof StmtNS.For) {
    return { k: "forinit", target: s.target.lexeme, iter: translateExpr(s.iter), src: s };
  }
  if (s instanceof StmtNS.FunctionDef) {
    const what = unsupportedParameters(s.parameters);
    return what ? { k: "unsupported", what } : { k: "def", src: s };
  }
  if (s instanceof StmtNS.Return)
    return { k: "return", e: s.value ? translateExpr(s.value) : null };
  if (s instanceof StmtNS.Pass) return { k: "pass" };
  if (s instanceof StmtNS.Break) return { k: "break" };
  if (s instanceof StmtNS.Continue) return { k: "continue" };
  if (s instanceof StmtNS.Global) return { k: "global", names: s.names.map(n => n.lexeme) };
  if (s instanceof StmtNS.NonLocal) return { k: "nonlocal", names: s.names.map(n => n.lexeme) };
  const names: Record<string, string> = {
    TupleAssign: "assignment to several names",
    AttributeAssign: "assignment to attributes",
    ForUnpack: "unpacking in for loops",
    Class: "classes",
    Decorated: "decorators",
    Try: "try statements",
    Raise: "raise statements",
    With: "with statements",
    Del: "del statements",
    Import: "import statements",
    FromImport: "imports",
    Assert: "assert statements",
    AnnAssign: "annotated assignment",
  };
  return { k: "unsupported", what: names[s.kind] ?? s.kind };
}
