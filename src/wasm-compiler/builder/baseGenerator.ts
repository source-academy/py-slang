import { ExprNS, StmtNS } from "../../ast-types";

export abstract class BaseGenerator<T>
  implements StmtNS.Visitor<T>, ExprNS.Visitor<T>
{
  visit(stmt: StmtNS.Stmt | ExprNS.Expr): T {
    return stmt.accept(this);
  }

  abstract visitFileInputStmt(stmt: StmtNS.FileInput): T;

  visitBigIntLiteralExpr(expr: ExprNS.BigIntLiteral): T {
    throw new Error("Method not implemented.");
  }
  visitBinaryExpr(expr: ExprNS.Binary): T {
    throw new Error("Method not implemented.");
  }
  visitCompareExpr(expr: ExprNS.Compare): T {
    throw new Error("Method not implemented.");
  }
  visitBoolOpExpr(expr: ExprNS.BoolOp): T {
    throw new Error("Method not implemented.");
  }
  visitGroupingExpr(expr: ExprNS.Grouping): T {
    throw new Error("Method not implemented.");
  }
  visitLiteralExpr(expr: ExprNS.Literal): T {
    throw new Error("Method not implemented.");
  }
  visitUnaryExpr(expr: ExprNS.Unary): T {
    throw new Error("Method not implemented.");
  }
  visitTernaryExpr(expr: ExprNS.Ternary): T {
    throw new Error("Method not implemented.");
  }
  visitLambdaExpr(expr: ExprNS.Lambda): T {
    throw new Error("Method not implemented.");
  }
  visitMultiLambdaExpr(expr: ExprNS.MultiLambda): T {
    throw new Error("Method not implemented.");
  }
  visitVariableExpr(expr: ExprNS.Variable): T {
    throw new Error("Method not implemented.");
  }
  visitCallExpr(expr: ExprNS.Call): T {
    throw new Error("Method not implemented.");
  }
  visitComplexExpr(expr: ExprNS.Complex): T {
    throw new Error("Method not implemented.");
  }
  visitNoneExpr(expr: ExprNS.None): T {
    throw new Error("Method not implemented.");
  }
  visitIndentCreation(stmt: StmtNS.Indent): T {
    throw new Error("Method not implemented.");
  }
  visitDedentCreation(stmt: StmtNS.Dedent): T {
    throw new Error("Method not implemented.");
  }
  visitPassStmt(stmt: StmtNS.Pass): T {
    throw new Error("Method not implemented.");
  }
  visitAssignStmt(stmt: StmtNS.Assign): T {
    throw new Error("Method not implemented.");
  }
  visitAnnAssignStmt(stmt: StmtNS.AnnAssign): T {
    throw new Error("Method not implemented.");
  }
  visitBreakStmt(stmt: StmtNS.Break): T {
    throw new Error("Method not implemented.");
  }
  visitContinueStmt(stmt: StmtNS.Continue): T {
    throw new Error("Method not implemented.");
  }
  visitReturnStmt(stmt: StmtNS.Return): T {
    throw new Error("Method not implemented.");
  }
  visitFromImportStmt(stmt: StmtNS.FromImport): T {
    throw new Error("Method not implemented.");
  }
  visitGlobalStmt(stmt: StmtNS.Global): T {
    throw new Error("Method not implemented.");
  }
  visitNonLocalStmt(stmt: StmtNS.NonLocal): T {
    throw new Error("Method not implemented.");
  }
  visitAssertStmt(stmt: StmtNS.Assert): T {
    throw new Error("Method not implemented.");
  }
  visitIfStmt(stmt: StmtNS.If): T {
    throw new Error("Method not implemented.");
  }
  visitWhileStmt(stmt: StmtNS.While): T {
    throw new Error("Method not implemented.");
  }
  visitForStmt(stmt: StmtNS.For): T {
    throw new Error("Method not implemented.");
  }
  visitFunctionDefStmt(stmt: StmtNS.FunctionDef): T {
    throw new Error("Method not implemented.");
  }
  visitSimpleExprStmt(stmt: StmtNS.SimpleExpr): T {
    throw new Error("Method not implemented.");
  }
}
