import { ExprNS, StmtNS } from "../ast-types";
import { TokenType } from "../tokens";
import { BaseGenerator } from "./baseGenerator";
import {
  applyFuncFactory,
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
  MAKE_NONE_FX,
  MAKE_STRING_FX,
  nameToFunctionMap,
  NEG_FUNC_NAME,
  STRING_COMPARE_FX,
} from "./constants";

const TAG_SUFFIX = "_tag";
const PAYLOAD_SUFFIX = "_payload";

const builtInFunctions: { name: string; arity: number; body: string }[] = [
  {
    name: "print",
    arity: 1,
    body: `(local.get $0_tag) (local.get $0_val) (call $log)`,
  },
];

export class Generator extends BaseGenerator<string> {
  private nativeFunctions = new Set<keyof typeof nameToFunctionMap>([
    MAKE_INT_FX,
    MAKE_FLOAT_FX,
    MAKE_COMPLEX_FX,
    MAKE_STRING_FX,
    MAKE_NONE_FX,
  ]);
  private strings: [string, number][] = [];
  private heapPointer = 0;

  // TODO: only globals and params, no locals for now
  private environments: string[][] = [[]];
  private userFunctionBodies: { [arity: number]: string[] | undefined } = {};

  private getNearestEnvironment(): string[] {
    const nearest = this.environments.at(-1);
    if (!nearest) {
      throw new Error("Environment stack is empty; this should never happen.");
    }
    return nearest;
  }

  private findInEnvironments(name: string): number {
    for (let i = this.environments.length - 1; i >= 0; i--) {
      if (this.environments[i].includes(name)) {
        return i;
      }
    }
    return -1;
  }

  private addFunctionBody(arity: number, body: string) {
    if (!this.userFunctionBodies[arity]) {
      this.userFunctionBodies[arity] = [];
    }
    this.userFunctionBodies[arity].push(body);
  }

  constructor() {
    super();
  }

  visitFileInputStmt(stmt: StmtNS.FileInput): string {
    if (stmt.statements.length <= 0) {
      console.log("No statements found");
      throw new Error("No statements found");
    }

    // declare built-in functions in the global environment before user code
    const builtInFuncsDeclarations = builtInFunctions
      .map(({ name, arity, body }) => {
        this.environments[0].push(name);
        const tag = this.userFunctionBodies[arity]?.length ?? 0;
        this.addFunctionBody(arity, body);

        return `(i32.const ${tag}) (i32.const ${arity}) (call ${MAKE_CLOSURE_FX}) (global.set $${name}${PAYLOAD_SUFFIX}) (global.set $${name}${TAG_SUFFIX})`;
      })
      .join("\n  ");

    const body = stmt.statements.map((s) => this.visit(s)).join("\n  ");

    // collect all globals, strings, native functions used and user functions

    // global environment is the first in the stack
    const globals = [...this.environments[0]]
      .flatMap((name) => [
        `(global $${name}${TAG_SUFFIX} (mut i32) (i32.const 0))`,
        `(global $${name}${PAYLOAD_SUFFIX} (mut i64) (i64.const 0))`,
      ])
      .join("\n  ");

    const strings = this.strings
      .map(([str, add]) => `(data (i32.const ${add}) "${str}")`)
      .join("\n  ");

    const nativeFunctions = [...this.nativeFunctions]
      .map((name) => nameToFunctionMap[name])
      .map((fx) => fx.replace(/\s{2,}/g, ""))
      .join("\n  ");

    const applyFunctions = Object.entries(this.userFunctionBodies)
      .map(
        ([arity, bodies]) => bodies && applyFuncFactory(Number(arity), bodies)
      )
      .filter((x) => x != null)
      .join("\n  ");

    return `
(module
  (import "js" "memory" (memory 1))
  ${LOG_FUNCS.join("\n  ")}

  (global ${HEAP_PTR} (mut i32) (i32.const ${this.heapPointer}))
  ${globals}

  ${strings}

  ${nativeFunctions}

  ${applyFunctions}
  
  (func $main \n ${builtInFuncsDeclarations} \n ${body})

  (start $main)
)`;
  }

  visitSimpleExprStmt(stmt: StmtNS.SimpleExpr): string {
    const expr = this.visit(stmt.expression);
    return `${expr} (drop) (drop)`; // drop tag and payload
  }

  visitGroupingExpr(expr: ExprNS.Grouping): string {
    return this.visit(expr.expression);
  }

  visitBinaryExpr(expr: ExprNS.Binary): string {
    this.nativeFunctions.add(ARITHMETIC_OP_FX);

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
    this.nativeFunctions.add(MAKE_BOOL_FX);
    this.nativeFunctions.add(STRING_COMPARE_FX);
    this.nativeFunctions.add(COMPARISON_OP_FX);

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

    this.nativeFunctions.add(NEG_FUNC_NAME);
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
        this.nativeFunctions.add(MAKE_BOOL_FX);
        return `(i32.const ${expr.value ? 1 : 0}) (call ${MAKE_BOOL_FX})`;
      case "string": {
        this.nativeFunctions.add(MAKE_STRING_FX);

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

    this.getNearestEnvironment().push(name);

    return `${expression} (global.set $${name}${PAYLOAD_SUFFIX}) (global.set $${name}${TAG_SUFFIX})`;
  }

  visitVariableExpr(expr: ExprNS.Variable): string {
    const name = expr.name.lexeme;
    const environmentIndex = this.findInEnvironments(name);
    if (environmentIndex < 0) {
      throw new Error(`Name ${name} not defined!`);
    } else if (environmentIndex === 0) {
      return `(global.get $${name}${TAG_SUFFIX}) (global.get $${name}${PAYLOAD_SUFFIX})`;
    } else {
      const index = this.environments[environmentIndex].indexOf(name);
      return `(local.get $${index}_tag) (local.get $${index}_val)`;
    }
  }

  visitFunctionDefStmt(stmt: StmtNS.FunctionDef): string {
    this.nativeFunctions.add(MAKE_CLOSURE_FX);

    const name = stmt.name.lexeme;
    const arity = stmt.parameters.length;
    const tag = this.userFunctionBodies[arity]?.length ?? 0;
    const wasm = `(i32.const ${tag}) (i32.const ${arity}) (call ${MAKE_CLOSURE_FX}) (global.set $${name}${PAYLOAD_SUFFIX}) (global.set $${name}${TAG_SUFFIX})`;

    this.getNearestEnvironment().push(name);

    this.environments.push([]);
    stmt.parameters.forEach((param) =>
      this.getNearestEnvironment().push(param.lexeme)
    );
    this.addFunctionBody(
      arity,
      stmt.body.map((stmt) => this.visit(stmt)).join(" ")
    );
    this.environments.pop();

    return wasm;
  }

  visitCallExpr(expr: ExprNS.Call): string {
    const callee = this.visit(expr.callee);
    const args = expr.args.map((arg) => this.visit(arg));
    const arity = args.length;

    return `${callee} ${args.join(" ")} (call $_apply_${arity})`;
  }

  visitReturnStmt(stmt: StmtNS.Return): string {
    const value = stmt.value;
    if (!value) {
      this.nativeFunctions.add(MAKE_NONE_FX);
      return `(call ${MAKE_NONE_FX}) (return)`;
    }

    const expr = this.visit(value);
    return `${expr} (return)`;
  }
}
