import { PARSE_TREE_STRINGS, WasmExports } from ".";
import { ExprNS, StmtNS } from "../ast-types";

interface BuilderVisitor<S, E> extends StmtNS.Visitor<S>, ExprNS.Visitor<E> {
  visit(stmt: StmtNS.Stmt): S;
  visit(stmt: ExprNS.Expr): E;
  visit(stmt: StmtNS.Stmt | ExprNS.Expr): S | E;
}

export class MetacircularGenerator implements BuilderVisitor<
  [number, bigint],
  [number, bigint]
> {
  private wasmExports: WasmExports;

  private list(...elements: [number, bigint][]): [number, bigint] {
    return elements.reduceRight(([tailTag, tailValue], [tag, value]) => {
      const pair = this.wasmExports.makePair(
        tag,
        BigInt(value),
        tailTag,
        BigInt(tailValue),
      );
      return pair;
    }, this.wasmExports.makeNone());
  }

  private string(str: (typeof PARSE_TREE_STRINGS)[number]): [number, bigint] {
    const index = PARSE_TREE_STRINGS.indexOf(str);
    const offset = PARSE_TREE_STRINGS.slice(0, index).reduce(
      (acc, s) => acc + s.length,
      0,
    );
    return this.wasmExports.makeString(offset, str.length);
  }

  constructor(wasmExports: WasmExports) {
    this.wasmExports = wasmExports;
  }

  visit(stmt: StmtNS.Stmt): [number, bigint];
  visit(stmt: ExprNS.Expr): [number, bigint];
  visit(stmt: StmtNS.Stmt | ExprNS.Expr): [number, bigint] {
    return stmt.accept(this);
  }

  visitFileInputStmt(stmt: StmtNS.FileInput): [number, bigint] {
    return this.visit(stmt.statements[0]);
  }

  visitSimpleExprStmt(stmt: StmtNS.SimpleExpr): [number, bigint] {
    return this.visit(stmt.expression);
  }

  visitBigIntLiteralExpr(expr: ExprNS.BigIntLiteral): [number, bigint] {
    const value = BigInt(expr.value);
    const min = BigInt("-9223372036854775808"); // -(2^63)
    const max = BigInt("9223372036854775807"); // (2^63) - 1
    if (value < min || value > max) {
      throw new Error(`BigInt literal out of bounds: ${expr.value}`);
    }

    return this.list(this.string("literal"), this.wasmExports.makeInt(value));
  }

  visitLiteralExpr(expr: ExprNS.Literal): [number, bigint] {
    if (typeof expr.value === "number")
      return this.list(
        this.string("literal"),
        this.wasmExports.makeFloat(expr.value),
      );
    else if (typeof expr.value === "boolean")
      return this.list(
        this.string("literal"),
        this.wasmExports.makeBool(expr.value ? 1 : 0),
      );
    else if (typeof expr.value === "string") {
      throw new Error(
        "String literals are not yet supported in the metacircular generator.",
      );
      // return this.list(
      //   this.string("literal"),
      //   this.wasmExports.makeString(expr.value.length, expr.value.length),
      // );
    } else {
      throw new Error(`Unsupported literal type: ${typeof expr.value}`);
    }
  }

  // UNSUPPORTED NODES
  visitIndentCreation(stmt: StmtNS.Indent): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitDedentCreation(stmt: StmtNS.Dedent): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitListExpr(expr: ExprNS.List): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitSubscriptExpr(expr: ExprNS.Subscript): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitStarredExpr(expr: ExprNS.Starred): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitPassStmt(stmt: StmtNS.Pass): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitAssignStmt(stmt: StmtNS.Assign): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitAnnAssignStmt(stmt: StmtNS.AnnAssign): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitBreakStmt(stmt: StmtNS.Break): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitContinueStmt(stmt: StmtNS.Continue): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitReturnStmt(stmt: StmtNS.Return): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitFromImportStmt(stmt: StmtNS.FromImport): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitGlobalStmt(stmt: StmtNS.Global): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitNonLocalStmt(stmt: StmtNS.NonLocal): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitAssertStmt(stmt: StmtNS.Assert): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitIfStmt(stmt: StmtNS.If): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitWhileStmt(stmt: StmtNS.While): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitForStmt(stmt: StmtNS.For): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitFunctionDefStmt(stmt: StmtNS.FunctionDef): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitBinaryExpr(expr: ExprNS.Binary): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitCompareExpr(expr: ExprNS.Compare): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitBoolOpExpr(expr: ExprNS.BoolOp): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitGroupingExpr(expr: ExprNS.Grouping): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitUnaryExpr(expr: ExprNS.Unary): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitTernaryExpr(expr: ExprNS.Ternary): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitLambdaExpr(expr: ExprNS.Lambda): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitMultiLambdaExpr(expr: ExprNS.MultiLambda): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitVariableExpr(expr: ExprNS.Variable): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitCallExpr(expr: ExprNS.Call): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitComplexExpr(expr: ExprNS.Complex): [number, bigint] {
    throw new Error("Method not implemented.");
  }
  visitNoneExpr(expr: ExprNS.None): [number, bigint] {
    throw new Error("Method not implemented.");
  }
}
