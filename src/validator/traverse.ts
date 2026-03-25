import { ExprNS, StmtNS } from "../ast-types";
import { ASTNode } from "./types";

/**
 * Walks the AST via the visitor pattern and calls fn on each node.
 *
 * NOTE: This is a standalone utility — the main validation pipeline does NOT
 * use this function. The Resolver runs validators inline during its own
 * accept()-based traversal (see resolver.ts:runValidators), which provides
 * the Environment parameter needed by scope-aware validators like
 * no-reassignment. Prefer the Resolver pipeline for production use.
 */
export function traverseAST(node: ASTNode, fn: (node: ASTNode) => void): void {
  fn(node);
  node.accept(new TraverseVisitor(fn));
}

class TraverseVisitor implements StmtNS.Visitor<void>, ExprNS.Visitor<void> {
  constructor(private fn: (node: ASTNode) => void) {}

  // ── Statements ──

  visitIndentCreation(stmt: StmtNS.Indent): void {}
  visitDedentCreation(stmt: StmtNS.Dedent): void {}

  visitFileInputStmt(stmt: StmtNS.FileInput): void {
    stmt.statements.forEach(s => traverseAST(s, this.fn));
  }

  visitFunctionDefStmt(stmt: StmtNS.FunctionDef): void {
    stmt.body.forEach(s => traverseAST(s, this.fn));
  }

  visitIfStmt(stmt: StmtNS.If): void {
    traverseAST(stmt.condition, this.fn);
    stmt.body.forEach(s => traverseAST(s, this.fn));
    if (stmt.elseBlock) stmt.elseBlock.forEach(s => traverseAST(s, this.fn));
  }

  visitWhileStmt(stmt: StmtNS.While): void {
    traverseAST(stmt.condition, this.fn);
    stmt.body.forEach(s => traverseAST(s, this.fn));
  }

  visitForStmt(stmt: StmtNS.For): void {
    traverseAST(stmt.iter, this.fn);
    stmt.body.forEach(s => traverseAST(s, this.fn));
  }

  visitAssignStmt(stmt: StmtNS.Assign): void {
    traverseAST(stmt.target as ASTNode, this.fn);
    traverseAST(stmt.value, this.fn);
  }

  visitAnnAssignStmt(stmt: StmtNS.AnnAssign): void {
    traverseAST(stmt.target, this.fn);
    traverseAST(stmt.value, this.fn);
    traverseAST(stmt.ann, this.fn);
  }

  visitReturnStmt(stmt: StmtNS.Return): void {
    if (stmt.value) traverseAST(stmt.value, this.fn);
  }

  visitAssertStmt(stmt: StmtNS.Assert): void {
    traverseAST(stmt.value, this.fn);
  }

  visitSimpleExprStmt(stmt: StmtNS.SimpleExpr): void {
    traverseAST(stmt.expression, this.fn);
  }

  // Leaf statements — no children to traverse.
  visitPassStmt(): void {}
  visitBreakStmt(): void {}
  visitContinueStmt(): void {}
  visitFromImportStmt(): void {}
  visitGlobalStmt(): void {}
  visitNonLocalStmt(): void {}

  // ── Expressions ──

  visitBinaryExpr(expr: ExprNS.Binary): void {
    traverseAST(expr.left, this.fn);
    traverseAST(expr.right, this.fn);
  }

  visitCompareExpr(expr: ExprNS.Compare): void {
    traverseAST(expr.left, this.fn);
    traverseAST(expr.right, this.fn);
  }

  visitBoolOpExpr(expr: ExprNS.BoolOp): void {
    traverseAST(expr.left, this.fn);
    traverseAST(expr.right, this.fn);
  }

  visitUnaryExpr(expr: ExprNS.Unary): void {
    traverseAST(expr.right, this.fn);
  }

  visitTernaryExpr(expr: ExprNS.Ternary): void {
    traverseAST(expr.predicate, this.fn);
    traverseAST(expr.consequent, this.fn);
    traverseAST(expr.alternative, this.fn);
  }

  visitGroupingExpr(expr: ExprNS.Grouping): void {
    traverseAST(expr.expression, this.fn);
  }

  visitCallExpr(expr: ExprNS.Call): void {
    traverseAST(expr.callee, this.fn);
    expr.args.forEach(a => traverseAST(a, this.fn));
  }

  visitLambdaExpr(expr: ExprNS.Lambda): void {
    traverseAST(expr.body, this.fn);
  }

  visitMultiLambdaExpr(expr: ExprNS.MultiLambda): void {
    expr.body.forEach(s => traverseAST(s, this.fn));
  }

  visitListExpr(expr: ExprNS.List): void {
    expr.elements.forEach(e => traverseAST(e, this.fn));
  }

  visitSubscriptExpr(expr: ExprNS.Subscript): void {
    traverseAST(expr.value, this.fn);
    traverseAST(expr.index, this.fn);
  }

  // Leaf expressions — no children to traverse.
  visitLiteralExpr(): void {}
  visitVariableExpr(): void {}
  visitBigIntLiteralExpr(): void {}
  visitComplexExpr(): void {}
  visitNoneExpr(): void {}
}
