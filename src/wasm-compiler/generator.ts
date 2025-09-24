import { ExprNS, StmtNS } from "../ast-types";
import { TokenType } from "../tokens";
import { BaseGenerator } from "./baseGenerator";
import {
  ARITHMETIC_OP_FX,
  ARITHMETIC_OP_TAG,
  COMPARISON_OP_FX,
  COMPARISON_OP_TAG,
  HEAP_PTR,
  LOG_FUNCS,
  MAKE_BOOL_FX,
  MAKE_CLOSURE_FX,
  MAKE_COMPLEX_FX,
  MAKE_FLOAT_FX,
  MAKE_INT_FX,
  MAKE_STRING_FX,
  nameToFunctionMap,
  NEG_FUNC_NAME,
  STRING_COMPARE_FX,
} from "./constants";

const TAG_SUFFIX = "_tag";
const PAYLOAD_SUFFIX = "_payload";

export class Generator extends BaseGenerator<string> {
  private functions = new Set<keyof typeof nameToFunctionMap>([
    MAKE_INT_FX,
    MAKE_FLOAT_FX,
    MAKE_COMPLEX_FX,
    MAKE_STRING_FX,
  ]);
  private strings: [string, number][] = [];
  private heapPointer = 0;

  private environment = new Set<string>();
  private userFunctions = new Map<string, string[]>();

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

    const globals = [...this.environment]
      .flatMap((name) => [
        `(global $${name}${TAG_SUFFIX} (mut i32) (i32.const 0))`,
        `(global $${name}${PAYLOAD_SUFFIX} (mut i64) (i64.const 0))`,
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
    this.functions.add(ARITHMETIC_OP_FX);

    const left = this.visit(expr.left);
    const right = this.visit(expr.right);

    const type = expr.operator.type;
    let opTag: number;
    if (type === TokenType.PLUS) opTag = ARITHMETIC_OP_TAG.ADD;
    else if (type === TokenType.MINUS) opTag = ARITHMETIC_OP_TAG.SUB;
    else if (type === TokenType.STAR) opTag = ARITHMETIC_OP_TAG.MUL;
    else if (type === TokenType.SLASH) opTag = ARITHMETIC_OP_TAG.DIV;
    else throw new Error(`Unsupported binary operator: ${type}`);

    return `${left} ${right} (i32.const ${opTag}) (call ${ARITHMETIC_OP_FX})`;
  }

  visitCompareExpr(expr: ExprNS.Compare): string {
    this.functions.add(MAKE_BOOL_FX);
    this.functions.add(STRING_COMPARE_FX);
    this.functions.add(COMPARISON_OP_FX);

    const left = this.visit(expr.left);
    const right = this.visit(expr.right);

    const type = expr.operator.type;
    let opTag: number;
    if (type === TokenType.DOUBLEEQUAL) opTag = COMPARISON_OP_TAG.EQ;
    else if (type === TokenType.NOTEQUAL) opTag = COMPARISON_OP_TAG.NEQ;
    else if (type === TokenType.LESS) opTag = COMPARISON_OP_TAG.LT;
    else if (type === TokenType.LESSEQUAL) opTag = COMPARISON_OP_TAG.LTE;
    else if (type === TokenType.GREATER) opTag = COMPARISON_OP_TAG.GT;
    else if (type === TokenType.GREATEREQUAL) opTag = COMPARISON_OP_TAG.GTE;
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
        this.functions.add(MAKE_STRING_FX);

        const str = expr.value;
        const len = str.length;
        const wasm = `(i32.const ${this.heapPointer}) (i32.const ${len}) (call ${MAKE_STRING_FX})`;

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

    this.environment.add(name);

    return `${expression} (global.set $${name}${PAYLOAD_SUFFIX}) (global.set $${name}${TAG_SUFFIX})`;
  }

  visitVariableExpr(expr: ExprNS.Variable): string {
    const name = expr.name.lexeme;
    if (!this.environment.has(name)) {
      throw new Error(`Variable not found: ${name}`);
    }
    return `(global.get $${name}${TAG_SUFFIX}) (global.get $${name}${PAYLOAD_SUFFIX})`;
  }

  visitFunctionDefStmt(stmt: StmtNS.FunctionDef): string {
    this.functions.add(MAKE_CLOSURE_FX);

    const name = stmt.name.lexeme;
    const params = stmt.parameters.map((p) => p.lexeme);

    this.userFunctions.set(name, params);
    this.environment.add(name);

    const functionIndex = this.userFunctions.size - 1;
    const arity = params.length;

    return `(i32.const ${functionIndex}) (i32.const ${arity}) (call ${MAKE_CLOSURE_FX}) (global.get $${name}${TAG_SUFFIX}) (global.get $${name}${PAYLOAD_SUFFIX})`;
  }
}
