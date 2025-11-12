import { i32, i64, wasm } from "wasm-util";
import { f64, global, local, mut } from "wasm-util/src/builder";
import { WasmCall, WasmInstruction } from "wasm-util/src/types";
import { ExprNS, StmtNS } from "../../ast-types";
import { TokenType } from "../../tokens";
import {
  ALLOC_ENV_FUNC,
  ARITHMETIC_OP_FX,
  ARITHMETIC_OP_TAG,
  CURR_ENV,
  GET_LEX_ADDR_FUNC,
  GET_PAIR_HEAD_FX,
  GET_PAIR_TAIL_FX,
  HEAP_PTR,
  MAKE_CLOSURE_FX,
  MAKE_INT_FX,
  MAKE_PAIR_FX,
  SET_PAIR_HEAD_FX,
  SET_PAIR_TAIL_FX,
} from "../constants";
import { BaseGenerator } from "../pyBaseGenerator";
import {
  APPLY_FX_NAME,
  applyFuncFactory,
  COMPARISON_OP_FX,
  COMPARISON_OP_TAG,
  GET_LEX_ADDR_FX,
  importedLogs,
  LOG_FX,
  MAKE_BOOL_FX,
  MAKE_COMPLEX_FX,
  MAKE_FLOAT_FX,
  MAKE_NONE_FX,
  MAKE_STRING_FX,
  nativeFunctions,
  NEG_FX,
  PRE_APPLY_FX,
  SET_LEX_ADDR_FX,
} from "./constants";

const builtInFunctions: {
  name: string;
  arity: number;
  body: WasmInstruction;
  isVoid: boolean;
}[] = [
  {
    name: "print",
    arity: 1,
    body: wasm
      .call(LOG_FX)
      .args(wasm.call(GET_LEX_ADDR_FUNC).args(i32.const(0), i32.const(0))),
    isVoid: true,
  },
  {
    name: "pair",
    arity: 2,
    body: wasm
      .call(MAKE_PAIR_FX)
      .args(
        wasm.call(GET_LEX_ADDR_FUNC).args(i32.const(0), i32.const(0)),
        wasm.call(GET_LEX_ADDR_FUNC).args(i32.const(0), i32.const(1))
      ),
    isVoid: false,
  },
  {
    name: "head",
    arity: 1,
    body: wasm
      .call(GET_PAIR_HEAD_FX)
      .args(wasm.call(GET_LEX_ADDR_FUNC).args(i32.const(0), i32.const(0))),
    isVoid: false,
  },
  {
    name: "tail",
    arity: 1,
    body: wasm
      .call(GET_PAIR_TAIL_FX)
      .args(wasm.call(GET_LEX_ADDR_FUNC).args(i32.const(0), i32.const(0))),
    isVoid: false,
  },
  {
    name: "set_head",
    arity: 2,
    body: wasm
      .call(SET_PAIR_HEAD_FX)
      .args(
        wasm.call(GET_LEX_ADDR_FUNC).args(i32.const(0), i32.const(0)),
        wasm.call(GET_LEX_ADDR_FUNC).args(i32.const(0), i32.const(1))
      ),
    isVoid: true,
  },
  {
    name: "set_tail",
    arity: 2,
    body: wasm
      .call(SET_PAIR_TAIL_FX)
      .args(
        wasm.call(GET_LEX_ADDR_FUNC).args(i32.const(0), i32.const(0)),
        wasm.call(GET_LEX_ADDR_FUNC).args(i32.const(0), i32.const(1))
      ),
    isVoid: true,
  },
];

type Binding = { name: string; tag: "local" | "nonlocal" };
// all expressions compile to a call to a makeX function, so expressions return
// WasmCalls. (every expression results in i32 i64)
export class BuilderGenerator extends BaseGenerator<WasmInstruction, WasmCall> {
  private strings: [string, number][] = [];
  private heapPointer = 0;

  private environment: Binding[][] = [[]];
  private userFunctions: WasmInstruction[][] = [];

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

  visitFileInputStmt(stmt: StmtNS.FileInput): WasmInstruction {
    if (stmt.statements.length <= 0) {
      console.log("No statements found");
      throw new Error("No statements found");
    }

    // declare built-in functions in the global environment before user code
    const builtInFuncsDeclarations = builtInFunctions.map(
      ({ name, arity, body, isVoid }, i) => {
        this.environment[0].push({ name, tag: "local" });
        const tag = this.userFunctions.length;
        const newBody = [
          body,
          ...(isVoid ? [wasm.call("$_log_none")] : []),
          global.set(CURR_ENV, local.get("$return_env")),
          wasm.return(),
        ];
        this.userFunctions.push(newBody);

        return wasm
          .call(SET_LEX_ADDR_FX)
          .args(
            i32.const(0),
            i32.const(i),
            wasm
              .call(MAKE_CLOSURE_FX)
              .args(
                i32.const(tag),
                i32.const(arity),
                i32.const(arity),
                global.get(CURR_ENV)
              )
          );
      }
    );

    this.environment[0].push(...this.collectDeclarations(stmt.statements));

    const body = stmt.statements.map((s) => this.visit(s));

    // this matches the format of drop in visitSimpleExpr
    const lastInstr = body.at(-1);
    const undroppedInstr =
      lastInstr?.op === "drop" &&
      lastInstr.value?.op === "drop" &&
      lastInstr.value.value;

    // collect all strings, native functions used and user functions
    const strings = this.strings.map(([str, add]) =>
      wasm.data(i32.const(add), str)
    );

    const applyFunction = applyFuncFactory(this.userFunctions);

    // because each variable has a tag and payload = 3 words
    const globalEnvLength = this.environment[0].length;

    return wasm
      .module()
      .imports(wasm.import("js", "memory").memory(1), ...importedLogs)
      .globals(
        wasm.global(HEAP_PTR, mut.i32).init(i32.const(this.heapPointer)),
        wasm.global(CURR_ENV, mut.i32).init(i32.const(0))
      )
      .datas(...strings)
      .funcs(
        ...nativeFunctions,
        applyFunction,

        wasm
          .func("$main")
          .results(...(undroppedInstr ? [i32, i64] : []))
          .body(
            wasm
              .call(ALLOC_ENV_FUNC)
              .args(i32.const(globalEnvLength), i32.const(0)),

            ...builtInFuncsDeclarations,

            ...(undroppedInstr ? [...body.slice(0, -1), undroppedInstr] : body)
          )
      )
      .exports(wasm.export("main").func("$main"))
      .build();
  }

  visitSimpleExprStmt(stmt: StmtNS.SimpleExpr): WasmInstruction {
    const expr = this.visit(stmt.expression);
    return wasm.drop(wasm.drop(expr));
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

  visitCompareExpr(expr: ExprNS.Compare): WasmCall {
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

    return wasm.call(COMPARISON_OP_FX).args(left, right, i32.const(opTag));
  }

  visitUnaryExpr(expr: ExprNS.Unary): WasmCall {
    const right = this.visit(expr.right);

    if (expr.operator.type !== TokenType.MINUS) {
      throw new Error(`Unsupported unary operator: ${expr.operator.type}`);
    }

    return wasm.call(NEG_FX).args(right);
  }

  visitBigIntLiteralExpr(expr: ExprNS.BigIntLiteral): WasmCall {
    const value = BigInt(expr.value);
    const min = BigInt("-9223372036854775808"); // -(2^63)
    const max = BigInt("9223372036854775807"); // (2^63) - 1
    if (value < min || value > max) {
      throw new Error(`BigInt literal out of bounds: ${expr.value}`);
    }

    return wasm.call(MAKE_INT_FX).args(i64.const(value));
  }

  visitLiteralExpr(expr: ExprNS.Literal): WasmCall {
    if (typeof expr.value === "number")
      return wasm.call(MAKE_FLOAT_FX).args(f64.const(expr.value));
    else if (typeof expr.value === "boolean")
      return wasm.call(MAKE_BOOL_FX).args(i32.const(expr.value ? 1 : 0));
    else if (typeof expr.value === "string") {
      const str = expr.value;
      const len = str.length;
      const toReturn = wasm
        .call(MAKE_STRING_FX)
        .args(i32.const(this.heapPointer), i32.const(len));

      this.strings.push([str, this.heapPointer]);
      this.heapPointer += len;
      return toReturn;
    } else {
      throw new Error(`Unsupported literal type: ${typeof expr.value}`);
    }
  }

  visitComplexExpr(expr: ExprNS.Complex): WasmCall {
    return wasm
      .call(MAKE_COMPLEX_FX)
      .args(f64.const(expr.value.real), f64.const(expr.value.imag));
  }

  visitAssignStmt(stmt: StmtNS.Assign): WasmInstruction {
    const [depth, index] = this.getLexAddress(stmt.name.lexeme);
    const expression = this.visit(stmt.value);

    return wasm
      .call(SET_LEX_ADDR_FX)
      .args(i32.const(depth), i32.const(index), expression);
  }

  visitVariableExpr(expr: ExprNS.Variable): WasmCall {
    const [depth, index] = this.getLexAddress(expr.name.lexeme);
    return wasm.call(GET_LEX_ADDR_FX).args(i32.const(depth), i32.const(index));
  }

  visitFunctionDefStmt(stmt: StmtNS.FunctionDef): WasmInstruction {
    const [depth, index] = this.getLexAddress(stmt.name.lexeme);
    const arity = stmt.parameters.length;
    const tag = this.userFunctions.length;
    this.userFunctions.push([]); // placeholder

    const newFrame = this.collectDeclarations(stmt.body, stmt.parameters);

    if (tag >= 1 << 16)
      throw new Error("Tag cannot be above 16-bit integer limit");
    if (arity >= 1 << 8)
      throw new Error("Arity cannot be above 8-bit integer limit");
    if (newFrame.length > 1 << 8)
      throw new Error("Environment length cannot be above 8-bit integer limit");

    this.environment.push(newFrame);
    const body = stmt.body.map((s) => this.visit(s));
    this.environment.pop();

    this.userFunctions[tag] = body;

    return wasm
      .call(SET_LEX_ADDR_FX)
      .args(
        i32.const(depth),
        i32.const(index),
        wasm
          .call(MAKE_CLOSURE_FX)
          .args(
            i32.const(tag),
            i32.const(arity),
            i32.const(newFrame.length),
            global.get(CURR_ENV)
          )
      );
  }

  visitCallExpr(expr: ExprNS.Call): WasmCall {
    const callee = this.visit(expr.callee);
    const args = expr.args.map((arg) => this.visit(arg));

    return wasm.call(APPLY_FX_NAME).args(
      global.get(CURR_ENV),
      wasm.call(PRE_APPLY_FX).args(callee, i32.const(args.length)),

      // these are not arguments, but they don't produce values, so it's ok to insert them here
      // this is to maintain the return type of WasmCall
      ...[...Array(args.length).keys()].map((i) =>
        wasm.call(SET_LEX_ADDR_FX).args(i32.const(0), i32.const(i), args[i])
      )
    );
  }

  visitReturnStmt(stmt: StmtNS.Return): WasmInstruction {
    const value = stmt.value;

    return wasm.return(
      value ? this.visit(value) : wasm.call(MAKE_NONE_FX),
      global.set(CURR_ENV, local.get("$return_env"))
    );
  }

  visitNonLocalStmt(stmt: StmtNS.NonLocal): WasmInstruction {
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

    return wasm.nop();
  }

  visitNoneExpr(expr: ExprNS.None): WasmCall {
    return wasm.call(MAKE_NONE_FX);
  }
}
