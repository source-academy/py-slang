import { ExprNS, StmtNS } from "../ast-types";

export abstract class BaseGenerator<S, E = S>
  implements StmtNS.Visitor<S>, ExprNS.Visitor<E>
{
  visit(stmt: StmtNS.Stmt): S;
  visit(stmt: ExprNS.Expr): E;
  visit(stmt: StmtNS.Stmt | ExprNS.Expr): S | E {
    return stmt.accept(this);
  }

  visitBigIntLiteralExpr(expr: ExprNS.BigIntLiteral): E {
    throw new Error("Method not implemented.");
  }
  visitBinaryExpr(expr: ExprNS.Binary): E {
    throw new Error("Method not implemented.");
  }
  visitCompareExpr(expr: ExprNS.Compare): E {
    throw new Error("Method not implemented.");
  }
  visitBoolOpExpr(expr: ExprNS.BoolOp): E {
    throw new Error("Method not implemented.");
  }
  visitGroupingExpr(expr: ExprNS.Grouping): E {
    throw new Error("Method not implemented.");
  }
  visitLiteralExpr(expr: ExprNS.Literal): E {
    throw new Error("Method not implemented.");
  }
  visitUnaryExpr(expr: ExprNS.Unary): E {
    throw new Error("Method not implemented.");
  }
  visitTernaryExpr(expr: ExprNS.Ternary): E {
    throw new Error("Method not implemented.");
  }
  visitLambdaExpr(expr: ExprNS.Lambda): E {
    throw new Error("Method not implemented.");
  }
  visitMultiLambdaExpr(expr: ExprNS.MultiLambda): E {
    throw new Error("Method not implemented.");
  }
  visitVariableExpr(expr: ExprNS.Variable): E {
    throw new Error("Method not implemented.");
  }
  visitCallExpr(expr: ExprNS.Call): E {
    throw new Error("Method not implemented.");
  }
  visitComplexExpr(expr: ExprNS.Complex): E {
    throw new Error("Method not implemented.");
  }
  visitNoneExpr(expr: ExprNS.None): E {
    throw new Error("Method not implemented.");
  }
  visitIndentCreation(stmt: StmtNS.Indent): S {
    throw new Error("Method not implemented.");
  }
  visitDedentCreation(stmt: StmtNS.Dedent): S {
    throw new Error("Method not implemented.");
  }
  visitPassStmt(stmt: StmtNS.Pass): S {
    throw new Error("Method not implemented.");
  }
  visitAssignStmt(stmt: StmtNS.Assign): S {
    throw new Error("Method not implemented.");
  }
  visitAnnAssignStmt(stmt: StmtNS.AnnAssign): S {
    throw new Error("Method not implemented.");
  }
  visitBreakStmt(stmt: StmtNS.Break): S {
    throw new Error("Method not implemented.");
  }
  visitContinueStmt(stmt: StmtNS.Continue): S {
    throw new Error("Method not implemented.");
  }
  visitReturnStmt(stmt: StmtNS.Return): S {
    throw new Error("Method not implemented.");
  }
  visitFromImportStmt(stmt: StmtNS.FromImport): S {
    throw new Error("Method not implemented.");
  }
  visitGlobalStmt(stmt: StmtNS.Global): S {
    throw new Error("Method not implemented.");
  }
  visitNonLocalStmt(stmt: StmtNS.NonLocal): S {
    throw new Error("Method not implemented.");
  }
  visitAssertStmt(stmt: StmtNS.Assert): S {
    throw new Error("Method not implemented.");
  }
  visitIfStmt(stmt: StmtNS.If): S {
    throw new Error("Method not implemented.");
  }
  visitWhileStmt(stmt: StmtNS.While): S {
    throw new Error("Method not implemented.");
  }
  visitForStmt(stmt: StmtNS.For): S {
    throw new Error("Method not implemented.");
  }
  visitFunctionDefStmt(stmt: StmtNS.FunctionDef): S {
    throw new Error("Method not implemented.");
  }
  visitSimpleExprStmt(stmt: StmtNS.SimpleExpr): S {
    throw new Error("Method not implemented.");
  }
  visitFileInputStmt(stmt: StmtNS.FileInput): S {
    throw new Error("Method not implemented.");
  }
}
