import { ExprNS, StmtNS } from "../ast-types";
import { TokenType } from "../tokens";
import { BaseGenerator } from "./baseGenerator";
import {
  ADD_TAG,
  ARITHMETIC_OP_FX,
  COMPARISON_OP_FX,
  DIV_TAG,
  EQ_TAG,
  GT_TAG,
  GTE_TAG,
  HEAP_PTR,
  LOG_FUNCS,
  LT_TAG,
  LTE_TAG,
  MAKE_BOOL_FX,
  MAKE_COMPLEX_FX,
  MAKE_FLOAT_FX,
  MAKE_INT_FX,
  MAKE_STRING_FX,
  MUL_TAG,
  nameToFunctionMap,
  NEG_FUNC_NAME,
  NEQ_TAG,
  STRING_COMPARE_FX,
  SUB_TAG,
} from "./constants";

export class Generator extends BaseGenerator<string> {
  private functions = new Set<keyof typeof nameToFunctionMap>([
    MAKE_INT_FX,
    MAKE_FLOAT_FX,
    MAKE_COMPLEX_FX,
    MAKE_STRING_FX,
  ]);
  private strings: [string, number][] = [];
  private heapPointer = 0;

  private environment = new Map<string, [string, string]>();

  visitFileInputStmt(stmt: StmtNS.FileInput): string {
    if (stmt.statements.length <= 0) {
      console.log("No statements found");
      throw new Error("No statements found");
    }

    const body = stmt.statements.map((s) => this.visit(s)).join("\n  ");

    const functions = [...this.functions]
      .map((name) => nameToFunctionMap[name])
      .map((fx) => fx.replace(/\s{2,}/g, ""))
      .join("\n  ");

    const globals = [...this.environment.values()]
      .flatMap(([nameTag, namePayload]) => [
        `(global ${nameTag} (mut i32) (i32.const 0))`,
        `(global ${namePayload} (mut i64) (i64.const 0))`,
      ])
      .join("\n  ");

    const strings = this.strings
      .map(([str, add]) => `(data (i32.const ${add}) "${str}")`)
      .join("\n  ");

    return `
(module
  (import "js" "memory" (memory 1))
  ${LOG_FUNCS.join("\n  ")}

  (global ${HEAP_PTR} (mut i32) (i32.const ${this.heapPointer}))
  ${globals}

  ${strings}

  ${functions}
  
  (func $main \n ${body} call $log)

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

    this.functions.add(ARITHMETIC_OP_FX);

    const type = expr.operator.type;
    let opTag: number;
    if (type === TokenType.PLUS) opTag = ADD_TAG;
    else if (type === TokenType.MINUS) opTag = SUB_TAG;
    else if (type === TokenType.STAR) opTag = MUL_TAG;
    else if (type === TokenType.SLASH) opTag = DIV_TAG;
    else throw new Error(`Unsupported binary operator: ${type}`);

    return `${left} ${right} (i32.const ${opTag}) (call ${ARITHMETIC_OP_FX})`;
  }

  visitCompareExpr(expr: ExprNS.Compare): string {
    const left = this.visit(expr.left);
    const right = this.visit(expr.right);

    this.functions.add(MAKE_BOOL_FX);
    this.functions.add(STRING_COMPARE_FX);
    this.functions.add(COMPARISON_OP_FX);

    const type = expr.operator.type;
    let opTag: number;
    if (type === TokenType.DOUBLEEQUAL) opTag = EQ_TAG;
    else if (type === TokenType.NOTEQUAL) opTag = NEQ_TAG;
    else if (type === TokenType.LESS) opTag = LT_TAG;
    else if (type === TokenType.LESSEQUAL) opTag = LTE_TAG;
    else if (type === TokenType.GREATER) opTag = GT_TAG;
    else if (type === TokenType.GREATEREQUAL) opTag = GTE_TAG;
    else throw new Error(`Unsupported comparison operator: ${type}`);

    return `${left} ${right} (i32.const ${opTag}) (call ${COMPARISON_OP_FX})`;
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

  visitAssignStmt(stmt: StmtNS.Assign): string {
    const expression = this.visit(stmt.value);
    const name = stmt.name.lexeme;
    const nameTag = `$_${stmt.name.lexeme}_tag`;
    const namePayload = `$_${stmt.name.lexeme}_payload`;

    this.environment.set(name, [nameTag, namePayload]);

    return `${expression} (global.set ${namePayload}) (global.set ${nameTag})`;
  }

  visitVariableExpr(expr: ExprNS.Variable): string {
    const tagPayload = this.environment.get(expr.name.lexeme);
    if (!tagPayload) {
      throw new Error(`Variable not found: ${expr.name.lexeme}`);
    }
    return `(global.get ${tagPayload[0]}) (global.get ${tagPayload[1]})`;
  }
}
