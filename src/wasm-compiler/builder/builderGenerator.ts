import { i32, i64, wasm } from "wasm-util";
import { WasmCall, WasmFunction, WasmInstruction } from "wasm-util/src/types";
import { ExprNS, StmtNS } from "../../ast-types";
import { TokenType } from "../../tokens";
import {
  ARITHMETIC_OP_FX,
  ARITHMETIC_OP_TAG,
  HEAP_PTR,
  MAKE_INT_FX,
} from "../constants";
import { BaseGenerator } from "../pyBaseGenerator";
import {
  arithmeticOpFunc,
  makeComplexFunc,
  makeFloatFunc,
  makeIntFunc,
  makeStringFunc,
} from "./constants";

// all expressions compile to a call to a makeX function, so expressions return
// WasmCalls. (every expression results in i32 i64)
export class BuilderGenerator extends BaseGenerator<WasmInstruction, WasmCall> {
  visitFileInputStmt(stmt: StmtNS.FileInput): WasmInstruction {
    return wasm
      .module()
      .imports(
        wasm.import("js", "memory").memory(1),
        wasm.import("console", "log").func("$_log_int").params("i64")
      )
      .globals(wasm.global(HEAP_PTR, "mut i32").init(i32.const(0)))
      .funcs(
        arithmeticOpFunc,
        makeIntFunc,
        makeFloatFunc,
        makeComplexFunc,
        makeStringFunc,
        wasm
          .func("$main")
          .body(
            ...(stmt.statements.map((s) => this.visit(s)) as Exclude<
              WasmInstruction,
              WasmFunction
            >[]),
            wasm.call("$_log_int").args(),
            wasm.drop()
          )
      )
      .startFunc("$main")
      .build();
  }

  visitSimpleExprStmt(stmt: StmtNS.SimpleExpr): WasmInstruction {
    const expr = this.visit(stmt.expression);
    return expr;
  }

  visitGroupingExpr(expr: ExprNS.Grouping): WasmCall {
    return this.visit(expr.expression);
  }

  visitBinaryExpr(expr: ExprNS.Binary): WasmCall {
    const left = this.visit(expr.left);
    const right = this.visit(expr.right);

    const type = expr.operator.type;
    let opTag: number;
    if (type === TokenType.PLUS) opTag = ARITHMETIC_OP_TAG.ADD;
    else if (type === TokenType.MINUS) opTag = ARITHMETIC_OP_TAG.SUB;
    else if (type === TokenType.STAR) opTag = ARITHMETIC_OP_TAG.MUL;
    else if (type === TokenType.SLASH) opTag = ARITHMETIC_OP_TAG.DIV;
    else throw new Error(`Unsupported binary operator: ${type}`);

    return wasm.call(ARITHMETIC_OP_FX).args(left, right, i32.const(opTag));
  }

  visitBigIntLiteralExpr(expr: ExprNS.BigIntLiteral): WasmCall {
    return wasm.call(MAKE_INT_FX).args(i64.const(BigInt(expr.value)));
  }
}
