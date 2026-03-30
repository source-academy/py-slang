import {
  f64,
  global,
  i32,
  i64,
  mut,
  wasm,
  WasmCall,
  WasmData,
  WasmExport,
  type WasmInstruction,
  type WasmNumeric,
  type WasmRaw,
} from "@sourceacademy/wasm-util";
import { WasmExports } from ".";
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
  DATA_END,
  DISCARD_SHADOW_STACK_FX,
  ENV_HEAD_SIZE,
  FROM_SPACE_END_PTR,
  GET_LEX_ADDR_FX,
  GET_LIST_ELEMENT_FX,
  HEAP_PTR,
  importedLogs,
  LOG_FX,
  MAKE_BOOL_FX,
  MAKE_CLOSURE_FX,
  MAKE_COMPLEX_FX,
  MAKE_FLOAT_FX,
  MAKE_INT_FX,
  MAKE_LIST_FX,
  MAKE_NONE_FX,
  MAKE_PAIR_FX,
  MAKE_STRING_FX,
  MALLOC_FX,
  nativeFunctions,
  NEG_FX,
  PEEK_SHADOW_STACK_FX,
  PRE_APPLY_FX,
  RETURN_NONVOID_SUFFIX,
  RETURN_VOID_SUFFIX,
  SET_CONTIGUOUS_BLOCK_FX,
  SET_LEX_ADDR_FX,
  SET_LIST_ELEMENT_FX,
  SHADOW_STACK_BOTTOM,
  SHADOW_STACK_PTR,
  SHADOW_STACK_RESERVED_SIZE,
  SHADOW_STACK_TAG,
  SHADOW_STACK_TOP,
  SILENT_PUSH_SHADOW_STACK_FX,
  TO_SPACE_END_PTR,
} from "./constants";
import { LibFuncType } from "./library";

const FOR_END_PREFIX = "_for_end_";
const FOR_STEP_PREFIX = "_for_step_";
const FOR_ITER_PREFIX = "_for_iter_";

type Binding = { name: string; tag: "local" | "nonlocal" };

interface BuilderVisitor<S, E> extends StmtNS.Visitor<S>, ExprNS.Visitor<E> {
  visit(stmt: StmtNS.Stmt): S;
  visit(stmt: ExprNS.Expr): E;
  visit(stmt: StmtNS.Stmt | ExprNS.Expr): S | E;
}

export class BuilderGenerator implements BuilderVisitor<WasmInstruction, WasmNumeric> {
  private strings: string[] = [];
  private builtIns: WasmCall[];
  private interactiveMode = false;
  private readonly pageCount: number;

  private environment: Binding[][] = [[]];
  private userFunctions: WasmInstruction[][] = [];
  private forDepth = 0;

  private getLexAddress(name: string): [number, number] {
    for (let i = this.environment.length - 1; i >= 0; i--) {
      const curr = this.environment[i];
      const index = curr.findIndex(b => b.name === name);

      if (index === -1) continue;

      if (curr[index].tag === "nonlocal") {
        throw new Error(`Name ${curr[index].name} is used prior to nonlocal declaration`);
      }

      return [this.environment.length - 1 - i, index];
    }
    throw new Error(`Name ${name} not defined!`);
  }

  private collectDeclarations(
    statements: StmtNS.Stmt[],
    parameters?: StmtNS.FunctionDef["parameters"],
  ): Binding[] {
    const findLexemes = (stmts: StmtNS.Stmt[], forDepth: number): string[] => {
      const found: string[] = [];
      for (const stmt of stmts) {
        if (stmt instanceof StmtNS.FunctionDef) {
          // base case: function declaration
          found.push(stmt.name.lexeme);
        } else if (stmt instanceof StmtNS.Assign && stmt.target instanceof ExprNS.Variable) {
          // base case: variable declaration in assignment statement
          found.push(stmt.target.name.lexeme);
        } else if (stmt instanceof StmtNS.If) {
          // recursively search if and else block
          found.push(...findLexemes(stmt.body, forDepth));
          if (stmt.elseBlock) {
            found.push(...findLexemes(stmt.elseBlock, forDepth));
          }
        } else if (stmt instanceof StmtNS.While) {
          // recursively search loop body
          found.push(...findLexemes(stmt.body, forDepth));
        } else if (stmt instanceof StmtNS.For) {
          // add _end, _step variables for range() to avoid evaluating args multiple times
          found.push(`${FOR_END_PREFIX}${forDepth}`);
          found.push(`${FOR_STEP_PREFIX}${forDepth}`);
          // add _iter variable to prevent mutation to loop variable affecting iteration
          found.push(`${FOR_ITER_PREFIX}${forDepth}`);
          // for loop target is also a declaration
          found.push(stmt.target.lexeme);
          found.push(...findLexemes(stmt.body, forDepth + 1));
        }
      }
      return found;
    };

    const bindings: Binding[] = findLexemes(statements, 0).map(lexeme => ({
      name: lexeme,
      tag: "local",
    }));

    statements
      .filter(s => s instanceof StmtNS.NonLocal)
      .map(s => s.name.lexeme)
      .forEach(l => {
        // nonlocal declaration must exist in a nonlocal scope
        if (!this.environment.find((frame, i) => i !== 0 && frame.find(({ name }) => name === l))) {
          throw new Error(`No binding for nonlocal ${l} found!`);
        }

        // cannot declare parameter name as nonlocal
        if (parameters && parameters.map(p => p.lexeme).includes(l)) {
          throw new Error(`${l} is parameter and nonlocal`);
        }

        // tag this binding as nonlocal so
        // if it's accessed before its nonlocal statement,
        // throw error
        bindings.forEach(binding => {
          if (binding.name === l) binding.tag = "nonlocal";
        });
      });

    return [
      ...(parameters?.map(p => ({ name: p.lexeme, tag: "local" as const })) ?? []),
      ...bindings,
    ];
  }

  constructor(
    initialStrings: string[],
    builtInFunctions: LibFuncType[],
    interactiveMode: boolean,
    pageCount: number,
  ) {
    this.strings = initialStrings;
    this.pageCount = pageCount;

    this.builtIns = builtInFunctions.map(({ name, arity, body, isVoid, hasVarArgs }, i) => {
      this.environment[0].push({ name, tag: "local" });
      const tag = this.userFunctions.length;
      const newBody = [
        ...body,
        wasm.return(...(isVoid ? RETURN_VOID_SUFFIX : RETURN_NONVOID_SUFFIX)),
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
              i32.const(hasVarArgs ? 1 : 0),
              i32.const(tag),
              i32.const(arity),
              i32.const(arity + (hasVarArgs ? 1 : 0)),
              global.get(CURR_ENV),
            ),
        );
    });
    this.interactiveMode = interactiveMode;
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

    this.environment[0].push(...this.collectDeclarations(stmt.statements));

    const body = stmt.statements.map(s => this.visit(s));

    // this matches the format of drop in visitSimpleExpr
    const lastInstr = body.at(-1);
    const hasLastInstr =
      this.interactiveMode &&
      lastInstr?.op === "drop" &&
      lastInstr.value?.op === "drop" &&
      lastInstr.value.value;

    // collect all strings
    const strings: WasmData[] = [];
    let heapPointer = 0;

    for (const str of this.strings) {
      strings.push(
        wasm.data(i32.const(heapPointer), str.replace(/"/g, '\\"').replace(/\n/g, "\\n")),
      );
      heapPointer += str.length;
    }

    // exported functions for parse
    const exports: { [key in keyof WasmExports]: WasmExport } = {
      main: wasm.export("main").func("$main"),
      log: wasm.export("log").func(LOG_FX.name),
      makeInt: wasm.export("makeInt").func(MAKE_INT_FX.name),
      makeFloat: wasm.export("makeFloat").func(MAKE_FLOAT_FX.name),
      makeBool: wasm.export("makeBool").func(MAKE_BOOL_FX.name),
      makeString: wasm.export("makeString").func(MAKE_STRING_FX.name),
      makePair: wasm.export("makePair").func(MAKE_PAIR_FX.name),
      makeNone: wasm.export("makeNone").func(MAKE_NONE_FX.name),
      malloc: wasm.export("malloc").func(MALLOC_FX.name),
      peekShadowStack: wasm.export("peekShadowStack").func(PEEK_SHADOW_STACK_FX.name),
    };

    const memoryEndPointer = this.pageCount * 64 * 1024;
    const semispaceEndPointer = memoryEndPointer - SHADOW_STACK_RESERVED_SIZE;
    const fromSpaceEndPointer = Math.floor(semispaceEndPointer / 2);

    return wasm
      .module()
      .imports(
        wasm.import("js", "memory").memory(this.pageCount),
        ...importedLogs,
        wasm
          .import("metacircular", "tokenize")
          .func("$_host_tokenize")
          .params(i32, i32)
          .results(i32, i64),
        wasm
          .import("metacircular", "parse")
          .func("$_host_parse")
          .params(i32, i32)
          .results(i32, i64),
      )
      .globals(
        wasm.global(DATA_END, i32).init(i32.const(heapPointer)),
        wasm.global(HEAP_PTR, mut.i32).init(i32.const(heapPointer)),
        wasm.global(FROM_SPACE_END_PTR, mut.i32).init(i32.const(fromSpaceEndPointer)),
        wasm.global(TO_SPACE_END_PTR, mut.i32).init(i32.const(semispaceEndPointer)),
        wasm.global(SHADOW_STACK_BOTTOM, i32).init(i32.const(semispaceEndPointer)),
        wasm.global(SHADOW_STACK_TOP, i32).init(i32.const(memoryEndPointer)),
        wasm.global(SHADOW_STACK_PTR, mut.i32).init(i32.const(memoryEndPointer)),
        wasm.global(CURR_ENV, mut.i32).init(i32.const(0)),
      )
      .datas(...strings)
      .funcs(
        ...nativeFunctions,
        applyFuncFactory(this.userFunctions),

        wasm
          .func("$main")
          .results(i32, i64)
          .body(
            global.set(
              CURR_ENV,
              wasm.call(ALLOC_ENV_FX).args(i32.const(this.environment[0].length)),
            ),

            // declare built-in constants/functions in the global environment before user code
            ...this.builtIns,

            ...(hasLastInstr
              ? [...body.slice(0, -1), hasLastInstr]
              : [...body, wasm.call(MAKE_NONE_FX)]),
          ),
      )
      .exports(...Object.values(exports))
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

  visitNoneExpr(_expr: ExprNS.None): WasmNumeric {
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
    if (typeof expr.value === "number") return wasm.call(MAKE_FLOAT_FX).args(f64.const(expr.value));
    else if (typeof expr.value === "boolean")
      return wasm.call(MAKE_BOOL_FX).args(i32.const(expr.value ? 1 : 0));
    else if (typeof expr.value === "string") {
      const toReturn = wasm
        .call(MAKE_STRING_FX)
        .args(
          i32.const(this.strings.reduce((acc, s) => acc + s.length, 0)),
          i32.const(expr.value.length),
        );
      this.strings.push(expr.value);
      return toReturn;
    } else {
      throw new Error(`Unsupported literal type: ${typeof expr.value}`);
    }
  }

  visitComplexExpr(expr: ExprNS.Complex): WasmNumeric {
    return wasm.call(MAKE_COMPLEX_FX).args(f64.const(expr.value.real), f64.const(expr.value.imag));
  }

  visitAssignStmt(stmt: StmtNS.Assign): WasmInstruction {
    const target = stmt.target;
    if (target instanceof ExprNS.Variable) {
      const [depth, index] = this.getLexAddress(target.name.lexeme);
      const expression = this.visit(stmt.value);

      return wasm.call(SET_LEX_ADDR_FX).args(i32.const(depth), i32.const(index), expression);
    } else if (target instanceof ExprNS.Subscript) {
      const value = this.visit(target.value);
      const index = this.visit(target.index);
      const expression = this.visit(stmt.value);

      return wasm.call(SET_LIST_ELEMENT_FX).args(value, index, expression);
    }
    throw new Error("Invalid assignment target");
  }

  visitVariableExpr(expr: ExprNS.Variable): WasmNumeric {
    const [depth, index] = this.getLexAddress(expr.name.lexeme);
    return wasm.call(GET_LEX_ADDR_FX).args(i32.const(depth), i32.const(index));
  }

  visitFunctionDefStmt(stmt: StmtNS.FunctionDef): WasmInstruction {
    const [depth, index] = this.getLexAddress(stmt.name.lexeme);
    const arity = stmt.parameters.filter(p => !p.isStarred).length;
    const tag = this.userFunctions.length;
    let hasStarred = false;
    this.userFunctions.push([]); // placeholder

    if (stmt.parameters.some(p => p.isStarred)) {
      if (stmt.parameters.filter(p => p.isStarred).length > 1) {
        throw new Error("Only one starred parameter is allowed");
      }
      if (stmt.parameters.findIndex(p => p.isStarred) !== stmt.parameters.length - 1) {
        throw new Error("Starred parameter must be the last parameter");
      }

      hasStarred = true;
    }

    const newFrame = this.collectDeclarations(stmt.body, stmt.parameters);

    if (tag >= 1 << 15) throw new Error("Tag cannot be above 15-bit integer limit");
    if (arity >= 1 << 8) throw new Error("Arity cannot be above 8-bit integer limit");
    if (newFrame.length > 1 << 8)
      throw new Error("Environment length cannot be above 8-bit integer limit");

    this.environment.push(newFrame);
    const body = stmt.body.map(s => this.visit(s));
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
            i32.const(hasStarred ? 1 : 0),
            i32.const(tag),
            i32.const(arity),
            i32.const(newFrame.length),
            global.get(CURR_ENV),
          ),
      );
  }

  visitLambdaExpr(expr: ExprNS.Lambda): WasmNumeric {
    const arity = expr.parameters.filter(p => !p.isStarred).length;
    const tag = this.userFunctions.length;
    let hasStarred = false;
    this.userFunctions.push([]); // placeholder

    if (expr.parameters.some(p => p.isStarred)) {
      if (expr.parameters.filter(p => p.isStarred).length > 1) {
        throw new Error("Only one starred parameter is allowed");
      }
      if (expr.parameters.findIndex(p => p.isStarred) !== expr.parameters.length - 1) {
        throw new Error("Starred parameter must be the last parameter");
      }

      hasStarred = true;
    }

    // no statements allowed in lambdas, so there won't be any new local declarations
    // other than parameters
    const newFrame = this.collectDeclarations([], expr.parameters);

    if (tag >= 1 << 15) throw new Error("Tag cannot be above 15-bit integer limit");
    if (arity >= 1 << 8) throw new Error("Arity cannot be above 8-bit integer limit");
    if (newFrame.length > 1 << 8)
      throw new Error("Environment length cannot be above 8-bit integer limit");

    this.environment.push(newFrame);
    const body = this.visit(expr.body);
    this.environment.pop();

    this.userFunctions[tag] = [wasm.return(body)];

    return wasm
      .call(MAKE_CLOSURE_FX)
      .args(
        i32.const(hasStarred ? 1 : 0),
        i32.const(tag),
        i32.const(arity),
        i32.const(newFrame.length),
        global.get(CURR_ENV),
      );
  }

  visitCallExpr(expr: ExprNS.Call): WasmCall {
    const callee = this.visit(expr.callee);
    const args = expr.args.map(arg => ({
      arg: this.visit(arg),
      isStarred: false,
    }));

    // push the return address onto the shadow stack first (for APPLY later).

    // we call PRE_APPLY next, which verifies the callee is a closure and arity matches
    // AND creates a new environment for the function call the size of the function call
    // argument length. it returns the pointer to this env, which we push onto the
    // shadow stack.

    // we manually set the arguments in the new environment using SET_CONTIGUOUS_BLOCK_FX
    // which reads the pointer to the new env from the shadow stack.

    // APPLY takes in the argument length. it reads the (3) call-state shadow stack values
    // directly. it also sets CURR_ENV, only after all arguments have been set to prevent
    // overlapping environments in nested function calls

    // if has varargs, the list elements are set directly after the last parameter
    // so we need to, in the APPLY_FX:
    // 1. set HEAP_PTR to the end of the varargs list,
    // 2. shift all the list elements over by 1 to make space for the varargs list
    // 3. make the list variable

    return wasm.call(APPLY_FX_NAME).args(
      wasm
        .call(SILENT_PUSH_SHADOW_STACK_FX) // (1) PUSH return address
        .args(i32.const(SHADOW_STACK_TAG.CALL_RETURN_ADDR), i64.extend_i32_u(global.get(CURR_ENV))),

      wasm.call(SILENT_PUSH_SHADOW_STACK_FX).args(
        i32.const(SHADOW_STACK_TAG.CALL_NEW_ENV), // (3) PUSH new env pointer
        i64.extend_i32_u(
          wasm.call(PRE_APPLY_FX).args(
            callee, // (2) callee is already PUSHED at this point
            i32.const(args.length),
          ),
        ),
      ),

      ...args.map((element, i) =>
        wasm
          .call(SET_CONTIGUOUS_BLOCK_FX)
          .args(
            i32.const(i),
            element.arg,
            i32.const(ENV_HEAD_SIZE),
            i32.const(element.isStarred ? 1 : 0),
          ),
      ),

      /* ! */ i32.const(args.length), // the only actual argument to APPLY, the rest are set up on the shadow stack
    );
  }

  visitReturnStmt(stmt: StmtNS.Return): WasmInstruction {
    const value = stmt.value;

    return wasm.return(
      value ? this.visit(value) : wasm.call(MAKE_NONE_FX),
      ...RETURN_NONVOID_SUFFIX,
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
    const bindingIndex = currFrame?.findIndex(binding => binding.name === stmt.name.lexeme);

    if (bindingIndex != null) {
      currFrame?.splice(bindingIndex, 1);
    }

    return wasm.nop();
  }

  visitIfStmt(stmt: StmtNS.If): WasmInstruction {
    const condition = this.visit(stmt.condition);
    const body = stmt.body.map(b => this.visit(b));
    const elseBody = stmt.elseBlock?.map(e => this.visit(e));

    return elseBody
      ? wasm
          .if(i32.wrap_i64(wasm.call(BOOLISE_FX).args(condition)))
          .then(...body)
          .else(...elseBody)
      : wasm.if(i32.wrap_i64(wasm.call(BOOLISE_FX).args(condition))).then(...body);
  }

  visitPassStmt(_stmt: StmtNS.Pass): WasmInstruction {
    return wasm.nop();
  }

  visitWhileStmt(stmt: StmtNS.While): WasmInstruction {
    const condition = this.visit(stmt.condition);
    const body = stmt.body.map(b => this.visit(b));

    return wasm.block("$exit").body(
      wasm.loop().body(
        wasm
          .if(i32.wrap_i64(wasm.call(BOOLISE_FX).args(condition)))
          .then(wasm.block("$continue").body(...body), wasm.br(1)), // 1 to jump to the beginning of the loop
      ),
    );
  }

  visitForStmt(stmt: StmtNS.For): WasmRaw {
    if (
      !(stmt.iter instanceof ExprNS.Call) ||
      !(stmt.iter.callee instanceof ExprNS.Variable) ||
      stmt.iter.callee.name.lexeme !== "range"
    ) {
      throw new Error("Only range() is supported in for loops");
    } else if (stmt.iter.args.length === 0) {
      throw new Error("range() requires at least one argument");
    } else if (stmt.iter.args.length > 3) {
      throw new Error("range() accepts at most 3 arguments");
    }

    this.forDepth += 1;
    const body = stmt.body.map(b => this.visit(b));
    this.forDepth -= 1;

    const targetLex = this.getLexAddress(stmt.target.lexeme).map(n => i32.const(n));
    const iterLex = this.getLexAddress(`${FOR_ITER_PREFIX}${this.forDepth}`).map(n => i32.const(n));
    const endLex = this.getLexAddress(`${FOR_END_PREFIX}${this.forDepth}`).map(n => i32.const(n));
    const stepLex = this.getLexAddress(`${FOR_STEP_PREFIX}${this.forDepth}`).map(n => i32.const(n));

    const setIter = wasm
      .call(SET_LEX_ADDR_FX)
      .args(...targetLex, wasm.call(GET_LEX_ADDR_FX).args(...iterLex));
    const loopCondition = (comparison: WasmNumeric) =>
      i32.wrap_i64(
        wasm
          .call(BOOLISE_FX)
          .args(
            wasm
              .call(COMPARISON_OP_FX)
              .args(
                wasm.call(GET_LEX_ADDR_FX).args(...iterLex),
                wasm.call(GET_LEX_ADDR_FX).args(...endLex),
                comparison,
              ),
          ),
      );
    const loopStep = (step: WasmNumeric) =>
      wasm
        .call(SET_LEX_ADDR_FX)
        .args(
          ...iterLex,
          wasm
            .call(ARITHMETIC_OP_FX)
            .args(
              wasm.call(GET_LEX_ADDR_FX).args(...iterLex),
              step,
              i32.const(ARITHMETIC_OP_TAG.ADD),
            ),
        );

    const rangeArgs = stmt.iter.args;

    if (rangeArgs.length === 1 || rangeArgs.length === 2) {
      return wasm.raw`
      ${wasm.call(SET_LEX_ADDR_FX).args(...iterLex, rangeArgs.length === 1 ? wasm.call(MAKE_INT_FX).args(i64.const(0)) : this.visit(rangeArgs[0]))}
      ${wasm.call(SET_LEX_ADDR_FX).args(...endLex, rangeArgs.length === 1 ? this.visit(rangeArgs[0]) : this.visit(rangeArgs[1]))}
      
      ${wasm
        .block("$exit")
        .body(
          wasm
            .loop()
            .body(
              wasm
                .if(loopCondition(i32.const(COMPARISON_OP_TAG.LT)))
                .then(
                  wasm.block("$continue").body(setIter, ...body),
                  loopStep(wasm.call(MAKE_INT_FX).args(i64.const(1))),
                  wasm.br(1),
                ),
            ),
        )}`;
    } else {
      return wasm.raw`
      ${wasm.call(SET_LEX_ADDR_FX).args(...iterLex, this.visit(rangeArgs[0]))}
      ${wasm.call(SET_LEX_ADDR_FX).args(...endLex, this.visit(rangeArgs[1]))}
      ${wasm.call(SET_LEX_ADDR_FX).args(...stepLex, this.visit(rangeArgs[2]))}

      ${wasm
        .if(
          i32.wrap_i64(
            wasm
              .call(BOOLISE_FX)
              .args(
                wasm
                  .call(COMPARISON_OP_FX)
                  .args(
                    wasm.call(GET_LEX_ADDR_FX).args(...stepLex),
                    wasm.call(MAKE_INT_FX).args(i64.const(0)),
                    i32.const(COMPARISON_OP_TAG.GT),
                  ),
              ),
          ),
        )
        .then(
          wasm
            .block("$exit")
            .body(
              wasm
                .loop()
                .body(
                  wasm
                    .if(loopCondition(i32.const(COMPARISON_OP_TAG.LT)))
                    .then(
                      wasm.block("$continue").body(setIter, ...body),
                      loopStep(wasm.call(GET_LEX_ADDR_FX).args(...stepLex)),
                      wasm.br(1),
                    ),
                ),
            ),
        )
        .else(
          wasm
            .block("$exit")
            .body(
              wasm
                .loop()
                .body(
                  wasm
                    .if(loopCondition(i32.const(COMPARISON_OP_TAG.GT)))
                    .then(
                      wasm.block("$continue").body(setIter, ...body),
                      loopStep(wasm.call(GET_LEX_ADDR_FX).args(...stepLex)),
                      wasm.br(1),
                    ),
                ),
            ),
        )}`;
    }
  }

  visitBreakStmt(_stmt: StmtNS.Break): WasmInstruction {
    return wasm.br("$exit");
  }

  visitContinueStmt(_stmt: StmtNS.Continue): WasmInstruction {
    return wasm.br("$continue");
  }

  visitListExpr(expr: ExprNS.List): WasmCall {
    const length = expr.elements.length;
    const elements = expr.elements.map(el => this.visit(el));

    // SET_CONTIGUOUS_BLOCK_FX to set list elements in a contiguous block
    // in the heap, and then make the list with MAKE_LIST_FX

    // ! indicates actual arguments - the rest are for setting up the list
    // in the shadow stack for SET_CONTIGUOUS_BLOCK_FX to write to
    return wasm.call(MAKE_LIST_FX).args(
      wasm
        .call(SILENT_PUSH_SHADOW_STACK_FX)
        .args(
          i32.const(SHADOW_STACK_TAG.LIST_STATE),
          i64.extend_i32_u(wasm.call(MALLOC_FX).args(i32.const(length * 12))),
        ),

      ...elements.map((element, i) =>
        wasm.call(SET_CONTIGUOUS_BLOCK_FX).args(i32.const(i), element, i32.const(0), i32.const(0)),
      ),

      /* ! */ i32.wrap_i64(i64.load(i32.add(global.get(SHADOW_STACK_PTR), i32.const(4)))),
      /* ! */ i32.const(length),
      wasm.call(DISCARD_SHADOW_STACK_FX), // discard the list state from the shadow stack
    );
  }

  visitSubscriptExpr(expr: ExprNS.Subscript): WasmNumeric {
    const value = this.visit(expr.value);
    const index = this.visit(expr.index);

    return wasm.call(GET_LIST_ELEMENT_FX).args(value, index);
  }

  // UNIMPLEMENTED PYTHON CONSTRUCTS
  visitMultiLambdaExpr(_expr: ExprNS.MultiLambda): WasmNumeric {
    throw new Error("Method not implemented.");
  }
  visitAnnAssignStmt(_stmt: StmtNS.AnnAssign): WasmInstruction {
    throw new Error("Method not implemented.");
  }
  visitFromImportStmt(_stmt: StmtNS.FromImport): WasmInstruction {
    throw new Error("Method not implemented.");
  }
  visitGlobalStmt(_stmt: StmtNS.Global): WasmInstruction {
    throw new Error("Method not implemented.");
  }
  visitAssertStmt(_stmt: StmtNS.Assert): WasmInstruction {
    throw new Error("Method not implemented.");
  }
}
