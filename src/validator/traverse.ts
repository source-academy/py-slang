import { StmtNS, ExprNS, FunctionParam } from "../ast-types";
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

/** The default values of parameters are expressions of the tree too. */
function traverseDefaults(parameters: FunctionParam[], fn: (node: ASTNode) => void): void {
  for (const param of parameters) if (param.default) traverseAST(param.default, fn);
}

class TraverseVisitor implements StmtNS.Visitor<void>, ExprNS.Visitor<void> {
  constructor(private fn: (node: ASTNode) => void) {}

  // ── Statements ──

  visitFileInputStmt(stmt: StmtNS.FileInput): void {
    stmt.statements.forEach(s => traverseAST(s, this.fn));
  }

  visitFunctionDefStmt(stmt: StmtNS.FunctionDef): void {
    traverseDefaults(stmt.parameters, this.fn);
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

  visitTupleAssignStmt(stmt: StmtNS.TupleAssign): void {
    traverseAST(stmt.target, this.fn);
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
    if (stmt.message) traverseAST(stmt.message, this.fn);
  }

  visitClassStmt(stmt: StmtNS.Class): void {
    stmt.bases.forEach(b => traverseAST(b, this.fn));
    stmt.body.forEach(s => traverseAST(s, this.fn));
  }

  visitDecoratedStmt(stmt: StmtNS.Decorated): void {
    stmt.decorators.forEach(d => traverseAST(d, this.fn));
    traverseAST(stmt.definition, this.fn);
  }

  visitTryStmt(stmt: StmtNS.Try): void {
    stmt.body.forEach(s => traverseAST(s, this.fn));
    for (const handler of stmt.handlers) {
      if (handler.type) traverseAST(handler.type, this.fn);
      handler.body.forEach(s => traverseAST(s, this.fn));
    }
    stmt.orElse?.forEach(s => traverseAST(s, this.fn));
    stmt.finalBody?.forEach(s => traverseAST(s, this.fn));
  }

  visitRaiseStmt(stmt: StmtNS.Raise): void {
    if (stmt.value) traverseAST(stmt.value, this.fn);
    if (stmt.cause) traverseAST(stmt.cause, this.fn);
  }

  visitWithStmt(stmt: StmtNS.With): void {
    for (const item of stmt.items) {
      traverseAST(item.context, this.fn);
      if (item.target) traverseAST(item.target, this.fn);
    }
    stmt.body.forEach(s => traverseAST(s, this.fn));
  }

  visitDelStmt(stmt: StmtNS.Del): void {
    stmt.targets.forEach(t => traverseAST(t, this.fn));
  }

  visitImportStmt(): void {}

  visitAugAssignStmt(stmt: StmtNS.AugAssign): void {
    traverseAST(stmt.target, this.fn);
    traverseAST(stmt.value, this.fn);
  }

  visitAttributeAssignStmt(stmt: StmtNS.AttributeAssign): void {
    traverseAST(stmt.target, this.fn);
    traverseAST(stmt.value, this.fn);
  }

  visitForUnpackStmt(stmt: StmtNS.ForUnpack): void {
    traverseAST(stmt.target, this.fn);
    traverseAST(stmt.iter, this.fn);
    stmt.body.forEach(s => traverseAST(s, this.fn));
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
    traverseDefaults(expr.parameters, this.fn);
    traverseAST(expr.body, this.fn);
  }

  visitMultiLambdaExpr(expr: ExprNS.MultiLambda): void {
    traverseDefaults(expr.parameters, this.fn);
    expr.body.forEach(s => traverseAST(s, this.fn));
  }

  visitListExpr(expr: ExprNS.List): void {
    expr.elements.forEach(e => traverseAST(e, this.fn));
  }

  visitSubscriptExpr(expr: ExprNS.Subscript): void {
    traverseAST(expr.value, this.fn);
    traverseAST(expr.index, this.fn);
  }

  visitAttributeExpr(expr: ExprNS.Attribute): void {
    traverseAST(expr.value, this.fn);
  }

  visitCompareChainExpr(expr: ExprNS.CompareChain): void {
    traverseAST(expr.left, this.fn);
    expr.comparators.forEach(c => traverseAST(c, this.fn));
  }

  visitTupleExpr(expr: ExprNS.Tuple): void {
    expr.elements.forEach(e => traverseAST(e, this.fn));
  }

  visitDictExpr(expr: ExprNS.Dict): void {
    expr.keys.forEach(e => traverseAST(e, this.fn));
    expr.values.forEach(e => traverseAST(e, this.fn));
  }

  visitKeywordExpr(expr: ExprNS.Keyword): void {
    traverseAST(expr.value, this.fn);
  }

  visitStarredExpr(expr: ExprNS.Starred): void {
    traverseAST(expr.value, this.fn);
  }

  // Leaf expressions — no children to traverse.
  visitLiteralExpr(): void {}
  visitVariableExpr(): void {}
  visitBigIntLiteralExpr(): void {}
  visitComplexExpr(): void {}
  visitNoneExpr(): void {}
}
