import { i32, i64, wasm } from "wasm-util";
import { global, local, mut } from "wasm-util/src/builder";
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
  applyFuncFactory,
  importedLogs,
  LOG_FX,
  nativeFunctions,
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
    const implicitReturn =
      body[body.length - 1].op === "drop" &&
      body[body.length - 2].op === "drop";

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
          .results(...(implicitReturn ? [i32, i64] : []))
          .body(
            wasm
              .call(ALLOC_ENV_FUNC)
              .args(i32.const(globalEnvLength), i32.const(0)),

            ...builtInFuncsDeclarations,

            ...(implicitReturn ? body.slice(0, -2) : body)
          )
      )
      .exports(wasm.export("main").func("$main"));
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
