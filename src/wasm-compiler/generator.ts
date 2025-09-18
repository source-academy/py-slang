import { ExprNS, StmtNS } from "../ast-types";
import { TokenType } from "../tokens";
import { BaseGenerator } from "./baseGenerator";
import {
  ADD_FX,
  DIV_FX,
  EQ_FX,
  HEAP_PTR,
  LOG_FUNCS,
  MAKE_BOOL_FX,
  MAKE_COMPLEX_FX,
  MAKE_FLOAT_FX,
  MAKE_INT_FX,
  MAKE_STRING_FX,
  MUL_FX,
  nameToFunctionMap,
  NEG_FUNC_NAME,
  NEQ_FX,
  SUB_FX,
} from "./constants";

export class Generator extends BaseGenerator<string> {
  private functions = new Set<keyof typeof nameToFunctionMap>([
    MAKE_INT_FX,
    MAKE_FLOAT_FX,
    MAKE_COMPLEX_FX,
  ]);
  private strings: [string, number][] = [];
  private heapPointer = 0;

  visitFileInputStmt(stmt: StmtNS.FileInput): string {
    const firstStatement = stmt.statements[0];
    if (!firstStatement) {
      console.log("No statements found");
      throw new Error("No statements found");
    }

    const body = this.visit(firstStatement);

    const functionString = [...this.functions]
      .map((name) => nameToFunctionMap[name])
      .map((fx) => fx.replace(/\s{2,}/g, ""))
      .join("\n  ");

    return `
(module
  (import "js" "memory" (memory 1))
  ${LOG_FUNCS.join("\n  ")}

  (global ${HEAP_PTR} (mut i32) (i32.const ${this.heapPointer}))

  ${this.strings
    .map(([str, add]) => `(data (i32.const ${add}) "${str}")`)
    .join("\n  ")}

  ${functionString}
  
  (func $main ${body} call $log)

  (start $main)
)`;
  }

  visitSimpleExprStmt(stmt: StmtNS.SimpleExpr): string {
    return this.visit(stmt.expression);
  }

  visitGroupingExpr(expr: ExprNS.Grouping): string {
    return this.visit(expr.expression);
  }

  visitBinaryExpr(expr: ExprNS.Binary): string {
    const left = this.visit(expr.left);
    const right = this.visit(expr.right);
    const operator = (() => {
      switch (expr.operator.type) {
        case TokenType.PLUS:
          this.functions.add(MAKE_STRING_FX);
          this.functions.add(ADD_FX);
          return `(call ${ADD_FX})`;
        case TokenType.MINUS:
          this.functions.add(SUB_FX);
          return `(call ${SUB_FX})`;
        case TokenType.STAR:
          this.functions.add(MUL_FX);
          return `(call ${MUL_FX})`;
        case TokenType.SLASH:
          this.functions.add(DIV_FX);
          this.functions.add(MAKE_FLOAT_FX);
          return `(call ${DIV_FX})`;
        default:
          throw new Error(`Unsupported binary operator: ${expr.operator.type}`);
      }
    })();

    return `${left} ${right} ${operator}`;
  }

  visitCompareExpr(expr: ExprNS.Compare): string {
    const left = this.visit(expr.left);
    const right = this.visit(expr.right);
    const operator = (() => {
      switch (expr.operator.type) {
        case TokenType.DOUBLEEQUAL:
          this.functions.add(MAKE_BOOL_FX);
          this.functions.add(EQ_FX);
          return `(call ${EQ_FX})`;
        case TokenType.NOTEQUAL:
          this.functions.add(MAKE_BOOL_FX);
          this.functions.add(EQ_FX);
          this.functions.add(NEQ_FX);
          return `(call ${NEQ_FX})`;
        default:
          throw new Error(
            `Unsupported comparison operator: ${expr.operator.type}`
          );
      }
    })();

    return `${left} ${right} ${operator}`;
  }

  visitUnaryExpr(expr: ExprNS.Unary): string {
    const right = this.visit(expr.right);

    if (expr.operator.type !== TokenType.MINUS) {
      throw new Error(`Unsupported unary operator: ${expr.operator.type}`);
    }

    this.functions.add(NEG_FUNC_NAME);
    const operator = `(call ${NEG_FUNC_NAME})`;

    return `${right} ${operator}`;
  }

  visitBigIntLiteralExpr(expr: ExprNS.BigIntLiteral): string {
    const value = BigInt(expr.value);
    const min = BigInt("-9223372036854775808"); // -(2^63)
    const max = BigInt("9223372036854775807"); // (2^63) - 1
    if (value < min || value > max) {
      throw new Error(`BigInt literal out of bounds: ${expr.value}`);
    }

    return `(i64.const ${expr.value}) (call ${MAKE_INT_FX})`;
  }

  visitLiteralExpr(expr: ExprNS.Literal): string {
    switch (typeof expr.value) {
      case "number":
        return `(f64.const ${expr.value}) (call ${MAKE_FLOAT_FX})`;
      case "boolean":
        this.functions.add(MAKE_BOOL_FX);
        return `(i32.const ${expr.value ? 1 : 0}) (call ${MAKE_BOOL_FX})`;
      case "string": {
        const str = expr.value;
        const len = str.length;
        const wasm = `(i32.const ${this.heapPointer}) (i32.const ${len}) (call ${MAKE_STRING_FX})`;

        this.functions.add(MAKE_STRING_FX);
        this.strings.push([str, this.heapPointer]);
        this.heapPointer += len;
        return wasm;
      }
      default:
        throw new Error(`Unsupported literal type: ${typeof expr.value}`);
    }
  }

  visitComplexExpr(expr: ExprNS.Complex): string {
    return `(f64.const ${expr.value.real}) (f64.const ${expr.value.imag}) (call ${MAKE_COMPLEX_FX})`;
  }
}
