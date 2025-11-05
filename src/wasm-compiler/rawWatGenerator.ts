import { ExprNS, StmtNS } from "../ast-types";
import { TokenType } from "../tokens";
import { BaseGenerator } from "./baseGeneratorForPy";
import {
  ALLOC_ENV_FUNC,
  APPLY_FUNC,
  applyFuncFactory,
  ARITHMETIC_OP_FX,
  ARITHMETIC_OP_TAG,
  COMPARISON_OP_FX,
  COMPARISON_OP_TAG,
  CURR_ENV,
  GET_LEX_ADDR_FUNC,
  GET_PAIR_HEAD_FX,
  GET_PAIR_TAIL_FX,
  HEAP_PTR,
  LOG_FUNCS,
  MAKE_BOOL_FX,
  MAKE_CLOSURE_FX,
  MAKE_COMPLEX_FX,
  MAKE_FLOAT_FX,
  MAKE_INT_FX,
  MAKE_NONE_FX,
  MAKE_PAIR_FX,
  MAKE_STRING_FX,
  nameToFunctionMap,
  NEG_FUNC_NAME,
  SET_LEX_ADDR_FUNC,
  SET_PAIR_HEAD_FX,
  SET_PAIR_TAIL_FX,
  STRING_COMPARE_FX,
} from "./constants";

const builtInFunctions: {
  name: string;
  arity: number;
  body: string;
  isVoid: boolean;
}[] = [
  {
    name: "print",
    arity: 1,
    body: `(i32.const 0) (i32.const 0) (call ${GET_LEX_ADDR_FUNC}) (call $log)`,
    isVoid: true,
  },
  {
    name: "pair",
    arity: 2,
    body: `(i32.const 0) (i32.const 0) (call ${GET_LEX_ADDR_FUNC}) (i32.const 0) (i32.const 1) (call ${GET_LEX_ADDR_FUNC}) (call ${MAKE_PAIR_FX})`,
    isVoid: false,
  },
  {
    name: "head",
    arity: 1,
    body: `(i32.const 0) (i32.const 0) (call ${GET_LEX_ADDR_FUNC}) (call ${GET_PAIR_HEAD_FX})`,
    isVoid: false,
  },
  {
    name: "tail",
    arity: 1,
    body: `(i32.const 0) (i32.const 0) (call ${GET_LEX_ADDR_FUNC}) (call ${GET_PAIR_TAIL_FX})`,
    isVoid: false,
  },
  {
    name: "set_head",
    arity: 2,
    body: `(i32.const 0) (i32.const 0) (call ${GET_LEX_ADDR_FUNC}) (i32.const 0) (i32.const 1) (call ${GET_LEX_ADDR_FUNC}) (call ${SET_PAIR_HEAD_FX})`,
    isVoid: true,
  },
  {
    name: "set_tail",
    arity: 2,
    body: `(i32.const 0) (i32.const 0) (call ${GET_LEX_ADDR_FUNC}) (i32.const 0) (i32.const 1) (call ${GET_LEX_ADDR_FUNC}) (call ${SET_PAIR_TAIL_FX})`,
    isVoid: true,
  },
];

type Binding = { name: string; tag: "local" | "nonlocal" };
export class Generator extends BaseGenerator<string> {
  private nativeFunctions = new Set<keyof typeof nameToFunctionMap>([
    ALLOC_ENV_FUNC,
    MAKE_INT_FX,
    MAKE_FLOAT_FX,
    MAKE_COMPLEX_FX,
    MAKE_STRING_FX,
    MAKE_NONE_FX,
    MAKE_CLOSURE_FX,
    GET_LEX_ADDR_FUNC,
    SET_LEX_ADDR_FUNC,
    MAKE_PAIR_FX,
    GET_PAIR_HEAD_FX,
    GET_PAIR_TAIL_FX,
    SET_PAIR_HEAD_FX,
    SET_PAIR_TAIL_FX,
  ]);
  private strings: [string, number][] = [];
  private heapPointer = 0;

  private environment: Binding[][] = [[]];
  private userFunctions: { [arity: number]: string[] | undefined } = {};

  private getLexAddress(name: string): [number, number] {
    for (let i = this.environment.length - 1; i >= 0; i--) {
      const curr = this.environment[i];
      const index = curr.findIndex((b) => b.name === name);

      if (index !== -1) {
        // check if variable is used before nonlocal declaration
        if (curr[index].tag === "nonlocal") {
          throw new Error(
            `Name ${curr[index].name} is used prior to nonlocal declaration`
          );
        }

        return [this.environment.length - 1 - i, index];
      }
    }
    throw new Error(`Name ${name} not defined!`);
  }

  private collectDeclarations(
    statements: StmtNS.Stmt[],
    parameters?: StmtNS.FunctionDef["parameters"]
  ): Binding[] {
    const bindings: Binding[] = statements
      .filter(
        (s) => s instanceof StmtNS.Assign || s instanceof StmtNS.FunctionDef
      )
      .map((s) => ({ name: s.name.lexeme, tag: "local" }));

    statements
      .filter((s) => s instanceof StmtNS.NonLocal)
      .map((s) => s.name.lexeme)
      .forEach((name) => {
        // nonlocal declaration must exist in a nonlocal scope
        if (
          !this.environment.find(
            (frame, i) =>
              i !== 0 && frame.find((binding) => binding.name === name)
          )
        )
          throw new Error(`No binding for nonlocal ${name} found!`);

        // cannot declare parameter name as nonlocal
        if (parameters && parameters.map((p) => p.lexeme).includes(name)) {
          throw new Error(`${name} is parameter and nonlocal`);
        }

        for (let i = 0; i < bindings.length; i++) {
          const binding = bindings[i];
          if (binding.name === name) {
            // tag this binding as nonlocal so
            // if it's accessed before its nonlocal statement,
            // throw error
            bindings[i].tag = "nonlocal";
          }
        }
      });

    return [
      ...(parameters?.map((p) => ({ name: p.lexeme, tag: "local" as const })) ??
        []),
      ...bindings,
    ];
  }

  visitFileInputStmt(stmt: StmtNS.FileInput): string {
    if (stmt.statements.length <= 0) {
      console.log("No statements found");
      throw new Error("No statements found");
    }

    // declare built-in functions in the global environment before user code
    const builtInFuncsDeclarations = builtInFunctions
      .map(({ name, arity, body, isVoid }, i) => {
        this.environment[0].push({ name, tag: "local" });
        const tag = this.userFunctions[arity]?.length ?? 0;
        this.userFunctions[arity] ??= [];

        const newBody = `${body}${
          isVoid ? `(call ${MAKE_NONE_FX})` : ""
        } (local.get $return_env) (global.set ${CURR_ENV}) (return)`;
        this.userFunctions[arity][tag] = newBody;

        return `(i32.const 0) (i32.const ${i}) (i32.const ${tag}) (i32.const ${arity}) (i32.const ${arity}) (global.get ${CURR_ENV}) (call ${MAKE_CLOSURE_FX}) (call ${SET_LEX_ADDR_FUNC})`;
      })
      .join("\n  ");

    this.environment[0].push(...this.collectDeclarations(stmt.statements));

    const body = stmt.statements.map((s) => this.visit(s)).join("\n  ");
    const implicitReturn = body.endsWith("(drop) (drop)");

    // collect all globals, strings, native functions used and user functions

    const strings = this.strings
      .map(([str, add]) => `(data (i32.const ${add}) "${str}")`)
      .join("\n  ");

    const nativeFunctions = [...this.nativeFunctions]
      .map((name) => nameToFunctionMap[name])
      .map((fx) => fx.replace(/\s{2,}/g, ""))
      .join("\n  ");

    const applyFunctions = Object.entries(this.userFunctions)
      .map(
        ([arity, bodies]) => bodies && applyFuncFactory(Number(arity), bodies)
      )
      .filter((x) => x != null)
      .join("\n  ");

    // because each variable has a tag and payload = 3 words
    const globalEnvLength = this.environment[0].length;

    return `
(module
  (import "js" "memory" (memory 1))
  ${LOG_FUNCS.join("\n  ")}

  (global ${HEAP_PTR} (mut i32) (i32.const ${this.heapPointer}))
  (global ${CURR_ENV} (mut i32) (i32.const 0))

  ${strings}

  ${nativeFunctions}

  ${applyFunctions}
  
  (func $main ${implicitReturn ? "(result i32 i64)" : ""}
    (i32.const ${globalEnvLength}) (i32.const 0) (call ${ALLOC_ENV_FUNC})
    ${builtInFuncsDeclarations}
    ${implicitReturn ? body.slice(0, -14) : body}
  )

  (export "main" (func $main))
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
    const [depth, index] = this.getLexAddress(stmt.name.lexeme);
    const expression = this.visit(stmt.value);

    return `(i32.const ${depth}) (i32.const ${index}) ${expression} (call ${SET_LEX_ADDR_FUNC})`;
  }

  visitVariableExpr(expr: ExprNS.Variable): string {
    const [depth, index] = this.getLexAddress(expr.name.lexeme);

    return `(i32.const ${depth}) (i32.const ${index}) (call ${GET_LEX_ADDR_FUNC})`;
  }

  visitFunctionDefStmt(stmt: StmtNS.FunctionDef): string {
    const [depth, index] = this.getLexAddress(stmt.name.lexeme);
    const arity = stmt.parameters.length;
    const tag = this.userFunctions[arity]?.length ?? 0;

    this.userFunctions[arity] ??= [];
    this.userFunctions[arity][tag] = "PLACEHOLDER";

    const newFrame = this.collectDeclarations(stmt.body, stmt.parameters);

    if (tag >= 1 << 16)
      throw new Error("Tag cannot be above 16-bit integer limit");
    if (arity >= 1 << 8)
      throw new Error("Arity cannot be above 8-bit integer limit");
    if (newFrame.length > 1 << 8)
      throw new Error("Environment length cannot be above 8-bit integer limit");

    this.environment.push(newFrame);
    const body = stmt.body.map((s) => this.visit(s)).join(" ");
    this.environment.pop();

    this.userFunctions[arity][tag] = body;

    return `(i32.const ${depth}) (i32.const ${index}) (i32.const ${tag}) (i32.const ${arity}) (i32.const ${newFrame.length}) (global.get ${CURR_ENV}) (call ${MAKE_CLOSURE_FX}) (call ${SET_LEX_ADDR_FUNC})`;
  }

  visitCallExpr(expr: ExprNS.Call): string {
    const callee = this.visit(expr.callee);
    const args = expr.args.map((arg) => this.visit(arg));

    return `${callee} ${args.join(" ")} (call ${APPLY_FUNC}${args.length})`;
  }

  visitReturnStmt(stmt: StmtNS.Return): string {
    const value = stmt.value;
    if (!value) {
      this.nativeFunctions.add(MAKE_NONE_FX);
      return `(call ${MAKE_NONE_FX}) (local.get $return_env) (global.set ${CURR_ENV}) (return)`;
    }

    const expr = this.visit(value);
    return `${expr} (local.get $return_env) (global.set ${CURR_ENV}) (return)`;
  }

  visitNonLocalStmt(stmt: StmtNS.NonLocal): string {
    // because of this.collectDeclarations, this nonlocal declaration
    // is guaranteed to have a nonlocal (and not global) binding.
    // because of this.getLexAddress, it's also guaranteed to not have been
    // used illegally before this statement.
    // all that's left to do is remove the binding from the compile time environment
    // from here onwards (from the local frame).
    // if it doesn't exist in the local frame, do nothing as the statement has
    // no effect

    const currFrame = this.environment.at(-1);
    const bindingIndex = currFrame?.findIndex(
      (binding) => binding.name === stmt.name.lexeme
    );

    if (bindingIndex != null) {
      currFrame?.splice(bindingIndex, 1);
    }

    return "";
  }

  visitNoneExpr(expr: ExprNS.None): string {
    this.nativeFunctions.add(MAKE_NONE_FX);
    return `(call ${MAKE_NONE_FX})`;
  }
}
