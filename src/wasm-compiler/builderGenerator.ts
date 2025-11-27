import { ExprNS, StmtNS } from "../ast-types";
import { TokenType } from "../tokens";
import {
  ALLOC_ENV_FX,
  APPLY_FX_NAME,
  applyFuncFactory,
  ARITHMETIC_OP_FX,
  ARITHMETIC_OP_TAG,
  BOOL_NOT_FX,
  BOOLISE_FX,
  COMPARISON_OP_FX,
  COMPARISON_OP_TAG,
  CURR_ENV,
  GET_LEX_ADDR_FX,
  GET_PAIR_HEAD_FX,
  GET_PAIR_TAIL_FX,
  HEAP_PTR,
  importedLogs,
  LOG_FX,
  MAKE_BOOL_FX,
  MAKE_CLOSURE_FX,
  MAKE_COMPLEX_FX,
  MAKE_FLOAT_FX,
  MAKE_INT_FX,
  MAKE_NONE_FX,
  MAKE_PAIR_FX,
  MAKE_STRING_FX,
  nativeFunctions,
  NEG_FX,
  PRE_APPLY_FX,
  SET_LEX_ADDR_FX,
  SET_PAIR_HEAD_FX,
  SET_PAIR_TAIL_FX,
  SET_PARAM_FX,
  TYPE_TAG,
} from "./constants";
import { f64, global, i32, i64, local, mut, wasm } from "./wasm-util/builder";
import { WasmInstruction, WasmNumeric, WasmRaw } from "./wasm-util/types";

const builtInFunctions: {
  name: string;
  arity: number;
  body: WasmInstruction | WasmInstruction[];
  isVoid: boolean;
}[] = [
  {
    name: "print",
    arity: 1,
    body: wasm
      .call(LOG_FX)
      .args(wasm.call(GET_LEX_ADDR_FX).args(i32.const(0), i32.const(0))),
    isVoid: true,
  },
  {
    name: "pair",
    arity: 2,
    body: wasm
      .call(MAKE_PAIR_FX)
      .args(
        wasm.call(GET_LEX_ADDR_FX).args(i32.const(0), i32.const(0)),
        wasm.call(GET_LEX_ADDR_FX).args(i32.const(0), i32.const(1))
      ),
    isVoid: false,
  },
  {
    name: "head",
    arity: 1,
    body: wasm
      .call(GET_PAIR_HEAD_FX)
      .args(wasm.call(GET_LEX_ADDR_FX).args(i32.const(0), i32.const(0))),
    isVoid: false,
  },
  {
    name: "tail",
    arity: 1,
    body: wasm
      .call(GET_PAIR_TAIL_FX)
      .args(wasm.call(GET_LEX_ADDR_FX).args(i32.const(0), i32.const(0))),
    isVoid: false,
  },
  {
    name: "set_head",
    arity: 2,
    body: wasm
      .call(SET_PAIR_HEAD_FX)
      .args(
        wasm.call(GET_LEX_ADDR_FX).args(i32.const(0), i32.const(0)),
        wasm.call(GET_LEX_ADDR_FX).args(i32.const(0), i32.const(1))
      ),
    isVoid: true,
  },
  {
    name: "set_tail",
    arity: 2,
    body: wasm
      .call(SET_PAIR_TAIL_FX)
      .args(
        wasm.call(GET_LEX_ADDR_FX).args(i32.const(0), i32.const(0)),
        wasm.call(GET_LEX_ADDR_FX).args(i32.const(0), i32.const(1))
      ),
    isVoid: true,
  },
  {
    name: "bool",
    arity: 1,
    body: [
      i32.const(TYPE_TAG.BOOL),
      wasm
        .call(BOOLISE_FX)
        .args(wasm.call(GET_LEX_ADDR_FX).args(i32.const(0), i32.const(0))),
    ],
    isVoid: false,
  },
];

type Binding = { name: string; tag: "local" | "nonlocal" };

interface BuilderVisitor<S, E> extends StmtNS.Visitor<S>, ExprNS.Visitor<E> {
  visit(stmt: StmtNS.Stmt): S;
  visit(stmt: ExprNS.Expr): E;
  visit(stmt: StmtNS.Stmt | ExprNS.Expr): S | E;
}

export class BuilderGenerator
  implements BuilderVisitor<WasmInstruction, WasmNumeric>
{
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

  visit(stmt: StmtNS.Stmt): WasmInstruction;
  visit(stmt: ExprNS.Expr): WasmNumeric;
  visit(stmt: StmtNS.Stmt | ExprNS.Expr): WasmInstruction | WasmNumeric {
    return stmt.accept(this);
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
          ...(Array.isArray(body) ? body : [body]),
          wasm.return(
            ...(isVoid ? [wasm.call(MAKE_NONE_FX)] : []),
            global.set(CURR_ENV, local.get("$return_env"))
          ),
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
            global.set(
              CURR_ENV,
              wasm
                .call(ALLOC_ENV_FX)
                .args(i32.const(globalEnvLength), i32.const(0), i32.const(0))
            ),

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

  visitGroupingExpr(expr: ExprNS.Grouping): WasmNumeric {
    return this.visit(expr.expression);
  }

  visitBinaryExpr(expr: ExprNS.Binary): WasmNumeric {
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

  visitCompareExpr(expr: ExprNS.Compare): WasmNumeric {
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

  visitUnaryExpr(expr: ExprNS.Unary): WasmNumeric {
    const right = this.visit(expr.right);

    const type = expr.operator.type;
    if (type === TokenType.MINUS) return wasm.call(NEG_FX).args(right);
    else if (type === TokenType.NOT) return wasm.call(BOOL_NOT_FX).args(right);
    else throw new Error(`Unsupported unary operator: ${type}`);
  }

  visitBoolOpExpr(expr: ExprNS.BoolOp): WasmNumeric {
    const left = this.visit(expr.left);
    const right = this.visit(expr.right);

    const type = expr.operator.type;

    // not a wasm function as it needs to short-circuit
    if (type === TokenType.AND) {
      // if x is false, then x else y
      return wasm
        .if(i64.eqz(wasm.call(BOOLISE_FX).args(left)))
        .results(i32, i64)
        .then(left)
        .else(right) as unknown as WasmNumeric; // these WILL return WasmNumeric
    } else if (type === TokenType.OR) {
      // if x is false, then y else x
      return wasm
        .if(i64.eqz(wasm.call(BOOLISE_FX).args(left)))
        .results(i32, i64)
        .then(right)
        .else(left) as unknown as WasmNumeric;
    } else throw new Error(`Unsupported boolean binary operator: ${type}`);
  }

  visitTernaryExpr(expr: ExprNS.Ternary): WasmNumeric {
    const consequent = this.visit(expr.consequent);
    const alternative = this.visit(expr.alternative);

    const predicate = this.visit(expr.predicate);

    return wasm
      .if(i32.wrap_i64(wasm.call(BOOLISE_FX).args(predicate)))
      .results(i32, i64)
      .then(consequent)
      .else(alternative) as unknown as WasmNumeric;
  }

  visitNoneExpr(expr: ExprNS.None): WasmNumeric {
    return wasm.call(MAKE_NONE_FX);
  }

  visitBigIntLiteralExpr(expr: ExprNS.BigIntLiteral): WasmNumeric {
    const value = BigInt(expr.value);
    const min = BigInt("-9223372036854775808"); // -(2^63)
    const max = BigInt("9223372036854775807"); // (2^63) - 1
    if (value < min || value > max) {
      throw new Error(`BigInt literal out of bounds: ${expr.value}`);
    }

    return wasm.call(MAKE_INT_FX).args(i64.const(value));
  }

  visitLiteralExpr(expr: ExprNS.Literal): WasmNumeric {
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

  visitComplexExpr(expr: ExprNS.Complex): WasmNumeric {
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

  visitVariableExpr(expr: ExprNS.Variable): WasmNumeric {
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

  visitLambdaExpr(expr: ExprNS.Lambda): WasmNumeric {
    const arity = expr.parameters.length;
    const tag = this.userFunctions.length;
    this.userFunctions.push([]); // placeholder

    // no statements allowed in lambdas, so there won't be any new local declarations
    // other than parameters
    const newFrame = this.collectDeclarations([], expr.parameters);

    if (tag >= 1 << 16)
      throw new Error("Tag cannot be above 16-bit integer limit");
    if (arity >= 1 << 8)
      throw new Error("Arity cannot be above 8-bit integer limit");
    if (newFrame.length > 1 << 8)
      throw new Error("Environment length cannot be above 8-bit integer limit");

    this.environment.push(newFrame);
    const body = this.visit(expr.body);
    this.environment.pop();

    this.userFunctions[tag] = [wasm.return(body)];

    return wasm
      .call(MAKE_CLOSURE_FX)
      .args(
        i32.const(tag),
        i32.const(arity),
        i32.const(newFrame.length),
        global.get(CURR_ENV)
      );
  }

  visitCallExpr(expr: ExprNS.Call): WasmRaw {
    const callee = this.visit(expr.callee);
    const args = expr.args.map((arg) => this.visit(arg));

    // PRE_APPLY returns (1, 2) callee tag and value, (3) pointer to new environment
    // APPLY expects (1) pointer to return environment, (2, 3) callee tag and value

    // we call PRE_APPLY first, which verifies the callee is a closure and arity matches
    // AND creates a new environment for the function call, but does not set CURR_ENV yet
    // this is so that we can set the arguments in the new environment first

    // this means we can't use SET_LEX_ADDR_FX because it uses CURR_ENV internally
    // so we manually set the arguments in the new environment using SET_PARAM_FX

    // the SET_PARAM function returns the env address after setting the parameter
    // so we can chain the calls together
    return wasm.raw`
${global.get(CURR_ENV)}
${wasm.call(PRE_APPLY_FX).args(callee, i32.const(args.length))}

${args.map(
  (arg, i) =>
    wasm.raw`
(i32.const ${i * 12}) (i32.add) ${arg} (call ${SET_PARAM_FX.name})`
)}

(global.set ${CURR_ENV})
(call ${APPLY_FX_NAME})
`;
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

  visitIfStmt(stmt: StmtNS.If): WasmInstruction {
    const condition = this.visit(stmt.condition);
    const body = stmt.body.map((b) => this.visit(b));
    const elseBody = stmt.elseBlock?.map((e) => this.visit(e));

    return elseBody
      ? wasm
          .if(i32.wrap_i64(wasm.call(BOOLISE_FX).args(condition)))
          .then(...body)
          .else(...elseBody)
      : wasm
          .if(i32.wrap_i64(wasm.call(BOOLISE_FX).args(condition)))
          .then(...body);
  }

  visitPassStmt(stmt: StmtNS.Pass): WasmInstruction {
    return wasm.nop();
  }

  // UNIMPLEMENTED PYTHON CONSTRUCTS
  visitMultiLambdaExpr(expr: ExprNS.MultiLambda): WasmNumeric {
    throw new Error("Method not implemented.");
  }
  visitIndentCreation(stmt: StmtNS.Indent): WasmInstruction {
    throw new Error("Method not implemented.");
  }
  visitDedentCreation(stmt: StmtNS.Dedent): WasmInstruction {
    throw new Error("Method not implemented.");
  }
  visitAnnAssignStmt(stmt: StmtNS.AnnAssign): WasmInstruction {
    throw new Error("Method not implemented.");
  }
  visitBreakStmt(stmt: StmtNS.Break): WasmInstruction {
    throw new Error("Method not implemented.");
  }
  visitContinueStmt(stmt: StmtNS.Continue): WasmInstruction {
    throw new Error("Method not implemented.");
  }
  visitFromImportStmt(stmt: StmtNS.FromImport): WasmInstruction {
    throw new Error("Method not implemented.");
  }
  visitGlobalStmt(stmt: StmtNS.Global): WasmInstruction {
    throw new Error("Method not implemented.");
  }
  visitAssertStmt(stmt: StmtNS.Assert): WasmInstruction {
    throw new Error("Method not implemented.");
  }
  visitWhileStmt(stmt: StmtNS.While): WasmInstruction {
    throw new Error("Method not implemented.");
  }
  visitForStmt(stmt: StmtNS.For): WasmInstruction {
    throw new Error("Method not implemented.");
  }
}
