/**
 * The program terms the environment stepper ("e-stepper") rewrites.
 *
 * Like the substitution stepper, the e-stepper shows the program being rewritten one reduction at a
 * time. Unlike it, values are the CSE machine's own runtime {@link Value}s (so operators, builtins,
 * lists and closures behave exactly as in the CSE machine), names are looked up in the CSE
 * machine's {@link Environment}s instead of being substituted away, and a function body under
 * evaluation is a {@link BlockExpr} that carries the environment it runs in. See
 * docs/e-stepper.md.
 *
 * Terms are immutable: a reduction builds a new term tree and shares unchanged subtrees, so the
 * term shown before a step and the one shown after it can be serialized independently. (The store
 * — environments and heap — is mutable; the driver snapshots it at every step.)
 *
 * Every term keeps the py-slang AST node it came from (`src`), which the CSE machine's operator and
 * error functions need for their messages.
 */

import { ExprNS, StmtNS } from "../../ast-types";
import type { Environment } from "../../engines/cse/environment";
import type { Value } from "../../engines/cse/stash";
import type { TokenType } from "../../tokenizer";

/* -------------------------------------------------------------------------- */
/*                                 Expressions                                */
/* -------------------------------------------------------------------------- */

/** A fully evaluated value. */
export interface ValExpr {
  k: "val";
  v: Value;
}

/** A name, looked up in the current environment when the enclosing redex contracts. */
export interface NameExpr {
  k: "name";
  name: string;
  src: ExprNS.Variable;
}

/** Arithmetic and comparison operators (both evaluate both operands). */
export interface BinExpr {
  k: "bin";
  op: TokenType;
  opText: string;
  left: Expr;
  right: Expr;
  src: ExprNS.Binary | ExprNS.Compare;
}

/** `and` / `or`: only the left operand is evaluated before the operator contracts. */
export interface BoolExpr {
  k: "bool";
  op: TokenType;
  opText: string;
  left: Expr;
  right: Expr;
  src: ExprNS.BoolOp;
}

export interface UnaryExpr {
  k: "unary";
  op: TokenType;
  opText: string;
  arg: Expr;
  src: ExprNS.Unary;
}

/** `cons if test else alt` */
export interface CondExpr {
  k: "cond";
  test: Expr;
  cons: Expr;
  alt: Expr;
  src: ExprNS.Ternary;
}

/** A lambda expression, not yet evaluated to a function object. */
export interface LambdaExpr {
  k: "lambda";
  src: ExprNS.Lambda;
}

export interface CallExpr {
  k: "call";
  callee: Expr;
  args: Expr[];
  /** Whether each argument is a spread argument (`*xs`). */
  starred: boolean[];
  src: ExprNS.Call;
}

export interface ListExpr {
  k: "list";
  elems: Expr[];
  src: ExprNS.List;
}

/** `obj[index]` */
export interface SubExpr {
  k: "sub";
  obj: Expr;
  index: Expr;
  src: ExprNS.Subscript;
}

/**
 * A function body under evaluation in environment `env`: what a call to a user-defined function
 * steps to. A `def` body is a statement list; a lambda body is an expression. Contracts to the
 * function's result when the body returns.
 */
export interface BlockExpr {
  k: "block";
  env: Environment;
  /** The called function's name (`"lambda"` for an anonymous function). */
  fname: string;
  body: Stmt[] | Expr;
}

/** A construct the e-stepper does not support; evaluation stops when it is reached. */
export interface UnsupportedExpr {
  k: "unsupported";
  what: string;
  src: ExprNS.Expr;
}

export type Expr =
  | ValExpr
  | NameExpr
  | BinExpr
  | BoolExpr
  | UnaryExpr
  | CondExpr
  | LambdaExpr
  | CallExpr
  | ListExpr
  | SubExpr
  | BlockExpr
  | UnsupportedExpr;

/* -------------------------------------------------------------------------- */
/*                                 Statements                                 */
/* -------------------------------------------------------------------------- */

export interface ExprStmt {
  k: "expr";
  e: Expr;
  src: StmtNS.Stmt;
}

/** `name = value` (also the per-iteration assignment of a `for` loop's target). */
export interface AssignStmt {
  k: "assign";
  name: string;
  value: Expr;
  src: StmtNS.Stmt;
}

/** `obj[index] = value` */
export interface SubAssignStmt {
  k: "subassign";
  obj: Expr;
  index: Expr;
  value: Expr;
  src: StmtNS.Assign;
}

export interface DefStmt {
  k: "def";
  src: StmtNS.FunctionDef;
}

export interface ReturnStmt {
  k: "return";
  e: Expr | null;
  src: StmtNS.Return;
}

/** An `if` statement, or a `while` loop unfolded into `if test: (body; while test: body)`. */
export interface IfStmt {
  k: "if";
  test: Expr;
  cons: Stmt[];
  alt: Stmt[] | null;
  src: StmtNS.If | StmtNS.While;
}

/** A `while` loop, as written: it unfolds into an `if` (see {@link IfStmt}), whose test is then
 * evaluated. Its body is translated afresh for each iteration. */
export interface WhileStmt {
  k: "while";
  test: Expr;
  src: StmtNS.While;
}

/** A `for i in range(...)` loop whose range arguments are still being evaluated. */
export interface ForInitStmt {
  k: "forinit";
  args: Expr[];
  src: StmtNS.For;
}

/** A `for` loop over `range(cur, end, step)`, about to test whether `cur` is in range. */
export interface ForStmt {
  k: "for";
  cur: bigint;
  end: bigint;
  step: bigint;
  src: StmtNS.For;
}

/**
 * One iteration of a loop in progress: the rest of the iteration's `body`, followed by `next`, the
 * loop itself (for the next iteration). `break` at the head of `body` ends the loop; `continue`
 * replaces the iteration by `next`.
 */
export interface LoopStmt {
  k: "loop";
  body: Stmt[];
  next: WhileStmt | ForStmt;
}

export interface SimpleStmt {
  k: "break" | "continue" | "pass";
  src: StmtNS.Stmt;
}

export interface ScopeStmt {
  k: "global" | "nonlocal";
  names: string[];
  src: StmtNS.Global | StmtNS.NonLocal;
}

/** A statement the e-stepper does not support; evaluation stops when it is reached. */
export interface UnsupportedStmt {
  k: "unsupported-stmt";
  what: string;
  src: StmtNS.Stmt;
}

export type Stmt = (
  | ExprStmt
  | AssignStmt
  | SubAssignStmt
  | DefStmt
  | ReturnStmt
  | IfStmt
  | WhileStmt
  | ForInitStmt
  | ForStmt
  | LoopStmt
  | SimpleStmt
  | ScopeStmt
  | UnsupportedStmt
) & {
  /**
   * Set once a gutter breakpoint on the statement has fired (see `Machine.stepList`), so that its
   * next steps, while it is partly evaluated, are not stops too.
   */
  breakpointFired?: boolean;
};

/* -------------------------------------------------------------------------- */
/*                                 Translation                                */
/* -------------------------------------------------------------------------- */

export const val = (v: Value): ValExpr => ({ k: "val", v });

export function translateExpr(expr: ExprNS.Expr): Expr {
  switch (expr.kind) {
    case "BigIntLiteral":
      return val({ type: "bigint", value: BigInt((expr as ExprNS.BigIntLiteral).value) });
    case "Literal": {
      const value = (expr as ExprNS.Literal).value;
      if (typeof value === "boolean") return val({ type: "bool", value });
      if (typeof value === "number") return val({ type: "number", value });
      if (typeof value === "string") return val({ type: "string", value });
      return val({ type: "none" });
    }
    case "Complex":
      return val({ type: "complex", value: (expr as ExprNS.Complex).value });
    case "None":
      return val({ type: "none" });
    case "Variable": {
      const e = expr as ExprNS.Variable;
      return { k: "name", name: e.name.lexeme, src: e };
    }
    case "Grouping":
      return translateExpr((expr as ExprNS.Grouping).expression);
    case "Binary":
    case "Compare": {
      const e = expr as ExprNS.Binary | ExprNS.Compare;
      return {
        k: "bin",
        op: e.operator.type,
        opText: e.operator.lexeme,
        left: translateExpr(e.left),
        right: translateExpr(e.right),
        src: e,
      };
    }
    case "BoolOp": {
      const e = expr as ExprNS.BoolOp;
      return {
        k: "bool",
        op: e.operator.type,
        opText: e.operator.lexeme,
        left: translateExpr(e.left),
        right: translateExpr(e.right),
        src: e,
      };
    }
    case "Unary": {
      const e = expr as ExprNS.Unary;
      return {
        k: "unary",
        op: e.operator.type,
        opText: e.operator.lexeme,
        arg: translateExpr(e.right),
        src: e,
      };
    }
    case "Ternary": {
      const e = expr as ExprNS.Ternary;
      return {
        k: "cond",
        test: translateExpr(e.predicate),
        cons: translateExpr(e.consequent),
        alt: translateExpr(e.alternative),
        src: e,
      };
    }
    case "Lambda":
      return { k: "lambda", src: expr as ExprNS.Lambda };
    case "Call": {
      const e = expr as ExprNS.Call;
      return {
        k: "call",
        callee: translateExpr(e.callee),
        args: e.args.map(a => translateExpr(a instanceof ExprNS.Starred ? a.value : a)),
        starred: e.args.map(a => a instanceof ExprNS.Starred),
        src: e,
      };
    }
    case "List": {
      const e = expr as ExprNS.List;
      return { k: "list", elems: e.elements.map(translateExpr), src: e };
    }
    case "Subscript": {
      const e = expr as ExprNS.Subscript;
      return { k: "sub", obj: translateExpr(e.value), index: translateExpr(e.index), src: e };
    }
    default:
      return { k: "unsupported", what: expr.kind, src: expr };
  }
}

export function translateStmts(stmts: StmtNS.Stmt[]): Stmt[] {
  return stmts.map(translateStmt);
}

export function translateStmt(stmt: StmtNS.Stmt): Stmt {
  switch (stmt.kind) {
    case "SimpleExpr":
      return { k: "expr", e: translateExpr((stmt as StmtNS.SimpleExpr).expression), src: stmt };
    case "Assign": {
      const s = stmt as StmtNS.Assign;
      if (s.target instanceof ExprNS.Subscript) {
        return {
          k: "subassign",
          obj: translateExpr(s.target.value),
          index: translateExpr(s.target.index),
          value: translateExpr(s.value),
          src: s,
        };
      }
      return { k: "assign", name: s.target.name.lexeme, value: translateExpr(s.value), src: s };
    }
    case "FunctionDef":
      return { k: "def", src: stmt as StmtNS.FunctionDef };
    case "Return": {
      const s = stmt as StmtNS.Return;
      return { k: "return", e: s.value ? translateExpr(s.value) : null, src: s };
    }
    case "If": {
      const s = stmt as StmtNS.If;
      return {
        k: "if",
        test: translateExpr(s.condition),
        cons: translateStmts(s.body),
        alt: s.elseBlock ? translateStmts(s.elseBlock) : null,
        src: s,
      };
    }
    case "While": {
      const s = stmt as StmtNS.While;
      return { k: "while", test: translateExpr(s.condition), src: s };
    }
    case "For": {
      const s = stmt as StmtNS.For;
      // The sublanguage validators only admit `for ... in range(...)`.
      return { k: "forinit", args: (s.iter as ExprNS.Call).args.map(translateExpr), src: s };
    }
    case "Break":
      return { k: "break", src: stmt };
    case "Continue":
      return { k: "continue", src: stmt };
    case "Pass":
      return { k: "pass", src: stmt };
    case "Global":
    case "NonLocal": {
      const s = stmt as StmtNS.Global | StmtNS.NonLocal;
      return {
        k: stmt.kind === "Global" ? "global" : "nonlocal",
        names: s.names.map(n => n.lexeme),
        src: s,
      };
    }
    default:
      return { k: "unsupported-stmt", what: stmt.kind, src: stmt };
  }
}
