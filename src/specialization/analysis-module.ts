import type { AbstractValue } from "../types/abstract-value";
import type { ExprNS, StmtNS } from "../ast-types";
import type { SlotLookup } from "./types";

export type PyASTNode = ExprNS.Expr | StmtNS.Stmt;

// ── ConstLattice ──────────────────────────────────────────────────────────────

export type ConstValue = number | boolean | string;

/**
 * Constant-propagation lattice element.
 *
 * Ordering: BOTTOM ≤ const(v) ≤ TOP
 *   - bottom  = "no info yet" — identity for join
 *   - const(v) = "definitely has value v on all paths so far"
 *   - top     = "overdefined / unknown"
 *
 * join(const(v), const(w)) = top when v ≠ w (paths disagree → lose the constant).
 * mergeKind = "may" so the existing DFAStatementDriver works unchanged.
 */
export type ConstLattice =
  | { readonly tag: "bottom" }
  | { readonly tag: "const"; readonly value: ConstValue }
  | { readonly tag: "top" };

export const CONST_BOTTOM: ConstLattice = Object.freeze({ tag: "bottom" as const });
export const CONST_TOP: ConstLattice    = Object.freeze({ tag: "top"    as const });
export function constOf(value: ConstValue): ConstLattice { return { tag: "const", value }; }

// ── OptimizationHint — product lattice across all analyses ────────────────────

export interface OptimizationHint {
  type?:     AbstractValue;
  constVal?: ConstLattice;
}

export type HintTable = WeakMap<PyASTNode, OptimizationHint>;

/**
 * An AST node with co-located analysis results. Ducks to the original type —
 * consumers that don't inspect `hint` see the same fields.
 */
export type Annotated<T extends PyASTNode> = T & { hint: OptimizationHint };

/**
 * Top-down annotation pass. Walks `stmts` and adds a `hint` property to every
 * expression node that has an entry in `hints`. Mutates the existing
 * AST node objects in-place (acceptable for a batch pipeline where the AST is
 * created fresh per chunk). After this call the WeakMap is no longer needed by
 * consumers; they read `node.hint` directly.
 */
export function annotateTree(stmts: StmtNS.Stmt[], hints: HintTable): void {
  const walker = new AnnotationWalker(hints);
  for (const stmt of stmts) stmt.accept(walker);
}

class AnnotationWalker implements ExprNS.Visitor<void>, StmtNS.Visitor<void> {
  constructor(private readonly hints: HintTable) {}

  private annotateExpr(expr: ExprNS.Expr): void {
    const hint = this.hints.get(expr);
    if (hint !== undefined) (expr as Annotated<ExprNS.Expr>).hint = hint;
    expr.accept(this);
  }

  private annotateBlock(stmts: StmtNS.Stmt[]): void {
    for (const s of stmts) s.accept(this);
  }

  // ── Expression visitor ──────────────────────────────────────────────────────

  visitBinaryExpr(expr: ExprNS.Binary): void {
    this.annotateExpr(expr.left);
    this.annotateExpr(expr.right);
  }
  visitCompareExpr(expr: ExprNS.Compare): void {
    this.annotateExpr(expr.left);
    this.annotateExpr(expr.right);
  }
  visitUnaryExpr(expr: ExprNS.Unary): void {
    this.annotateExpr(expr.right);
  }
  visitBoolOpExpr(expr: ExprNS.BoolOp): void {
    this.annotateExpr(expr.left);
    this.annotateExpr(expr.right);
  }
  visitCallExpr(expr: ExprNS.Call): void {
    this.annotateExpr(expr.callee);
    for (const arg of expr.args) this.annotateExpr(arg);
  }
  visitTernaryExpr(expr: ExprNS.Ternary): void {
    this.annotateExpr(expr.predicate);
    this.annotateExpr(expr.consequent);
    this.annotateExpr(expr.alternative);
  }
  visitGroupingExpr(expr: ExprNS.Grouping): void {
    this.annotateExpr(expr.expression);
  }
  visitListExpr(expr: ExprNS.List): void {
    for (const el of expr.elements) this.annotateExpr(el);
  }
  visitSubscriptExpr(expr: ExprNS.Subscript): void {
    this.annotateExpr(expr.value);
    this.annotateExpr(expr.index);
  }
  visitStarredExpr(expr: ExprNS.Starred): void {
    this.annotateExpr(expr.value);
  }
  // Lambda bodies are skipped (DFA doesn't descend into them)
  visitLambdaExpr(_expr: ExprNS.Lambda): void {}
  visitMultiLambdaExpr(_expr: ExprNS.MultiLambda): void {}
  // Leaf expressions
  visitLiteralExpr(_expr: ExprNS.Literal): void {}
  visitBigIntLiteralExpr(_expr: ExprNS.BigIntLiteral): void {}
  visitComplexExpr(_expr: ExprNS.Complex): void {}
  visitVariableExpr(_expr: ExprNS.Variable): void {}
  visitNoneExpr(_expr: ExprNS.None): void {}

  // ── Statement visitor ───────────────────────────────────────────────────────

  visitAssignStmt(stmt: StmtNS.Assign): void {
    this.annotateExpr(stmt.value);
  }
  visitAnnAssignStmt(stmt: StmtNS.AnnAssign): void {
    this.annotateExpr(stmt.value);
  }
  visitIfStmt(stmt: StmtNS.If): void {
    this.annotateExpr(stmt.condition);
    this.annotateBlock(stmt.body);
    if (stmt.elseBlock) this.annotateBlock(stmt.elseBlock);
  }
  visitWhileStmt(stmt: StmtNS.While): void {
    this.annotateExpr(stmt.condition);
    this.annotateBlock(stmt.body);
  }
  visitForStmt(stmt: StmtNS.For): void {
    this.annotateExpr(stmt.iter);
    this.annotateBlock(stmt.body);
  }
  visitReturnStmt(stmt: StmtNS.Return): void {
    if (stmt.value) this.annotateExpr(stmt.value);
  }
  visitSimpleExprStmt(stmt: StmtNS.SimpleExpr): void {
    this.annotateExpr(stmt.expression);
  }
  visitAssertStmt(stmt: StmtNS.Assert): void {
    this.annotateExpr(stmt.value);
  }
  visitFileInputStmt(stmt: StmtNS.FileInput): void {
    this.annotateBlock(stmt.statements);
  }
  // Function bodies skipped — same policy as DFA driver
  visitFunctionDefStmt(_stmt: StmtNS.FunctionDef): void {}
  // No-op statements
  visitPassStmt(_stmt: StmtNS.Pass): void {}
  visitBreakStmt(_stmt: StmtNS.Break): void {}
  visitContinueStmt(_stmt: StmtNS.Continue): void {}
  visitGlobalStmt(_stmt: StmtNS.Global): void {}
  visitNonLocalStmt(_stmt: StmtNS.NonLocal): void {}
  visitFromImportStmt(_stmt: StmtNS.FromImport): void {}
}

export interface StmtTransformRule {
  readonly name: string;
  readonly level: "stmt";
  matches(stmt: StmtNS.Stmt, hints: HintTable): boolean;
  /** Returns replacement statements. Empty array = delete the statement. */
  apply(stmt: StmtNS.Stmt, hints: HintTable): StmtNS.Stmt[];
}

export interface ExprTransformRule {
  readonly name: string;
  readonly level: "expr";
  matches(expr: ExprNS.Expr, hints: HintTable): boolean;
  /** Returns replacement expression (1:1). */
  apply(expr: ExprNS.Expr, hints: HintTable): ExprNS.Expr;
}

export type TransformRule = StmtTransformRule | ExprTransformRule;

export interface AnalysisModule<L> {
  readonly name: string;
  top(): L;
  bottom(): L;
  join(a: L, b: L): L;
  meet(a: L, b: L): L;
  leq(a: L, b: L): boolean;
  readonly mergeKind: "may" | "must";
  readonly direction: "forward" | "backward";
  readonly field: keyof OptimizationHint;

  /**
   * Create the expression-level visitor for this analysis.
   * The DFA driver calls this per expression sub-tree; the returned visitor
   * reads from `env` and writes computed facts to `hints`.
   */
  makeExprVisitor(
    hints: HintTable,
    env: readonly (L | undefined)[],
    slotLookup: SlotLookup,
  ): ExprNS.Visitor<L>;
}
