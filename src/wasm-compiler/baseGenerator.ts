import { ExprNS, StmtNS } from "../ast-types";

export abstract class BaseGenerator<T>
  implements StmtNS.Visitor<T>, ExprNS.Visitor<T>
{
  visit(stmt: StmtNS.Stmt | ExprNS.Expr): T {
    return stmt.accept(this);
  }

  abstract visitFileInputStmt(stmt: StmtNS.FileInput): T;
  abstract visitSimpleExprStmt(stmt: StmtNS.SimpleExpr): T;
  abstract visitGroupingExpr(expr: ExprNS.Grouping): T;
  abstract visitBinaryExpr(expr: ExprNS.Binary): T;
  abstract visitCompareExpr(expr: ExprNS.Compare): T;
  abstract visitUnaryExpr(expr: ExprNS.Unary): T;
  abstract visitBigIntLiteralExpr(expr: ExprNS.BigIntLiteral): T;
  abstract visitLiteralExpr(expr: ExprNS.Literal): T;
  abstract visitComplexExpr(expr: ExprNS.Complex): T;
  abstract visitAssignStmt(stmt: StmtNS.Assign): T;
  abstract visitVariableExpr(expr: ExprNS.Variable): T;
  abstract visitFunctionDefStmt(stmt: StmtNS.FunctionDef): T;
  abstract visitCallExpr(expr: ExprNS.Call): T;
  abstract visitReturnStmt(stmt: StmtNS.Return): T;

  visitBoolOpExpr(expr: ExprNS.BoolOp): T {
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
  visitAnnAssignStmt(stmt: StmtNS.AnnAssign): T {
    throw new Error("Method not implemented.");
  }
  visitBreakStmt(stmt: StmtNS.Break): T {
    throw new Error("Method not implemented.");
  }
  visitContinueStmt(stmt: StmtNS.Continue): T {
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
}
