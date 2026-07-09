import { ExprNS, StmtNS } from "../../ast-types";
import { Environment, FunctionEnvironments, Resolver } from "../../resolver";
import math from "../../stdlib/math";
import misc from "../../stdlib/misc";
import { Token, TokenType } from "../../tokenizer/tokenizer";
import { PVMLIRBuilder } from "./PVMLIRBuilder";
import { PRIMITIVE_FUNCTIONS } from "./builtins";
import OpCodes from "./opcodes";
import { PVMLProgram } from "./types";

/** Signed 32-bit integer bounds used to decide LGCI vs LGCF64 encoding. */
const I32_MIN = -2_147_483_648;
const I32_MAX = 2_147_483_647;

interface CompilerAnnotation {
  slot: number;
  envLevel: number;
  isPrimitive: boolean;
  primitiveIndex?: number;
  // VM-internal function (e.g. an EV3 device function) — compiles to
  // CALLV/CALLTV/NEWCV instead of CALLP/CALLTP/NEWCP. Populated only when
  // the compiler was constructed with an `internalFunctions` map; every
  // caller that doesn't pass one (PVMLEvaluator, PVMLSinterEvaluator, ...)
  // never sets this, so behavior for them is unchanged.
  isInternal?: boolean;
  internalIndex?: number;
}

export type ExpressionResult = {
  maxStackSize: number;
};

export class PVMLCompiler
  implements StmtNS.Visitor<ExpressionResult>, ExprNS.Visitor<ExpressionResult>
{
  private builder: PVMLIRBuilder;
  private currentEnvironment: Environment;
  private functionEnvironments: FunctionEnvironments;
  private isTailCall: boolean;
  private internalFunctions?: Map<string, number>;

  private tokenAnnotations: WeakMap<Token, CompilerAnnotation>;
  private envSlotCounters: WeakMap<Environment, number>;
  private envSlotMaps: WeakMap<Environment, Map<string, number>>;
  /** The builder whose function scope corresponds to each Environment — see getOrAssignSlot(). */
  private envBuilders: WeakMap<Environment, PVMLIRBuilder>;
  private tmpCounter = 0;

  private loopStack: Array<{
    breakLabel: number;
    continueLabel: number;
    iteratorOnStack: boolean;
  }> = [];

  /**
   * `tokenAnnotations`/`envSlotCounters`/`envSlotMaps` default to fresh maps
   * (the root compiler's case, via fromProgram) but MUST be passed through
   * from `fromFunctionNode` when creating a child compiler for a nested
   * function/lambda body. They track slot numbers per Environment object —
   * if each nested compiler got its own fresh maps, the first time it
   * resolves a name from an *enclosing* scope (e.g. a function referring to
   * a sibling or to itself recursively) it would independently assign that
   * name slot 0 in its own bookkeeping, colliding with whatever slot the
   * parent compiler already assigned that same environment's other names.
   */
  constructor(
    currentEnvironment: Environment,
    functionEnvironments: FunctionEnvironments,
    builder: PVMLIRBuilder,
    tokenAnnotations: WeakMap<Token, CompilerAnnotation> = new WeakMap(),
    envSlotCounters: WeakMap<Environment, number> = new WeakMap(),
    envSlotMaps: WeakMap<Environment, Map<string, number>> = new WeakMap(),
    envBuilders: WeakMap<Environment, PVMLIRBuilder> = new WeakMap(),
    internalFunctions?: Map<string, number>,
  ) {
    this.builder = builder;
    this.currentEnvironment = currentEnvironment;
    this.functionEnvironments = functionEnvironments;
    this.isTailCall = false;
    this.tokenAnnotations = tokenAnnotations;
    this.envSlotCounters = envSlotCounters;
    this.envSlotMaps = envSlotMaps;
    this.envBuilders = envBuilders;
    this.envBuilders.set(currentEnvironment, builder);
    this.internalFunctions = internalFunctions;
  }

  /**
   * Create PVMLCompiler from program AST.
   * Pass pre-computed environments (from analyzeWithEnvironments) to avoid a second resolver run.
   *
   * @param internalFunctions Optional map of VM-internal function names to their fixed
   * VM-internal indices (e.g. EV3's device function table). Names in this map compile to
   * CALLV/CALLTV/NEWCV instead of CALLP/CALLTP/NEWCP. Callers that don't pass this are
   * entirely unaffected.
   */
  static fromProgram(
    program: StmtNS.FileInput,
    functionEnvironments?: FunctionEnvironments,
    internalFunctions?: Map<string, number>,
  ): PVMLCompiler {
    if (!functionEnvironments) {
      const resolver = new Resolver("", program, [], [misc, math]);
      functionEnvironments = resolver.resolveEnvironments(program);
    }
    const mainEnv = functionEnvironments.get(program);
    if (!mainEnv) {
      throw new Error("Main program environment not found");
    }
    PVMLIRBuilder.resetIndex();
    const builder = new PVMLIRBuilder(0);
    return new PVMLCompiler(
      mainEnv,
      functionEnvironments,
      builder,
      undefined,
      undefined,
      undefined,
      undefined,
      internalFunctions,
    );
  }

  fromFunctionNode(node: StmtNS.FunctionDef | ExprNS.Lambda | ExprNS.MultiLambda): PVMLCompiler {
    const nextEnvironment = this.functionEnvironments.get(node);
    if (!nextEnvironment) {
      throw new Error(`Function environment not found`);
    }
    for (const param of node.parameters) {
      nextEnvironment.lookupNameCurrentEnvWithError(param);
    }
    const numArgs = node.parameters.length;
    const builder = this.builder.createChildBuilder(numArgs);

    const compiler = new PVMLCompiler(
      nextEnvironment,
      this.functionEnvironments,
      builder,
      this.tokenAnnotations,
      this.envSlotCounters,
      this.envSlotMaps,
      this.envBuilders,
      this.internalFunctions,
    );

    const slotMap = new Map<string, number>();
    compiler.envSlotMaps.set(nextEnvironment, slotMap);

    for (let i = 0; i < node.parameters.length; i++) {
      const paramName = node.parameters[i].lexeme;
      slotMap.set(paramName, i);
    }

    compiler.envSlotCounters.set(nextEnvironment, numArgs);

    return compiler;
  }

  compileProgram(program: StmtNS.FileInput): PVMLProgram {
    this.compile(program);

    const allBuilders = this.builder.getAllBuilders(true);
    const functions = allBuilders.map(b => b.build());

    return new PVMLProgram(0, functions);
  }

  compile(node: StmtNS.Stmt | ExprNS.Expr): ExpressionResult {
    return node.accept(this);
  }

  private getTokenAnnotation(token: Token): CompilerAnnotation {
    let annotation = this.tokenAnnotations.get(token);
    if (annotation) {
      return annotation;
    }

    const name = token.lexeme;
    const parentEnv = this.currentEnvironment.lookupNameEnv(token);

    if (parentEnv !== null && parentEnv.enclosing === null) {
      const internalIndex = this.internalFunctions?.get(name);
      if (internalIndex !== undefined) {
        annotation = {
          slot: internalIndex,
          envLevel: 0,
          isPrimitive: false,
          isInternal: true,
          internalIndex,
        };
      } else {
        const primitiveIndex = PRIMITIVE_FUNCTIONS.get(name);
        if (primitiveIndex === undefined) {
          throw new Error(`Primitive function ${name} not implemented`);
        }
        annotation = {
          slot: primitiveIndex,
          envLevel: 0,
          isPrimitive: true,
          primitiveIndex,
        };
      }
    } else if (parentEnv != null) {
      const envLevel = this.currentEnvironment.lookupName(token);
      const slot = this.getOrAssignSlot(parentEnv, name);

      annotation = {
        slot,
        envLevel,
        isPrimitive: false,
      };
    } else {
      throw new Error(`Variable ${name} not found in environment`);
    }

    this.tokenAnnotations.set(token, annotation);
    return annotation;
  }

  private getOrAssignSlot(env: Environment, name: string): number {
    let slotMap = this.envSlotMaps.get(env);
    if (!slotMap) {
      slotMap = new Map();
      this.envSlotMaps.set(env, slotMap);
      this.envSlotCounters.set(env, 0);
    }

    let slot = slotMap.get(name);
    if (slot === undefined) {
      slot = this.envSlotCounters.get(env)!;
      slotMap.set(name, slot);
      this.envSlotCounters.set(env, slot + 1);
      // Charge the new local slot to whichever builder's function scope `env`
      // actually is — NOT necessarily `this.builder`, since `env` can be an
      // *enclosing* scope reached via a cross-scope reference (e.g. a
      // function calling a sibling, or referring to itself recursively).
      const owningBuilder = this.envBuilders.get(env);
      if (!owningBuilder) {
        throw new Error("No builder registered for environment");
      }
      owningBuilder.noteSymbolUsed();
    }
    return slot;
  }

  private emitLoadSymbol(token: Token): ExpressionResult {
    const annotation = this.getTokenAnnotation(token);

    if (annotation.isPrimitive) {
      // A primitive referenced as a value rather than called directly (e.g.
      // `is_function(print)`, `f = abs`) — NEWCP pushes a callable reference
      // to it, mirroring native Pynter's "ifn" nanbox tag. A direct call
      // (`print(x)`) never reaches this branch: emitFunctionCall emits
      // CALLP/CALLTP straight from the primitive index instead.
      this.builder.emitUnary(OpCodes.NEWCP, annotation.primitiveIndex);
      return { maxStackSize: 1 };
    }
    if (annotation.isInternal) {
      // Same as the isPrimitive branch above, but for a VM-internal (device)
      // function referenced as a value rather than called directly. NEWCV
      // is CALLV/CALLTV's "reference" counterpart, mirroring NEWCP/CALLP.
      this.builder.emitUnary(OpCodes.NEWCV, annotation.internalIndex);
      return { maxStackSize: 1 };
    }
    if (annotation.envLevel === 0) {
      this.builder.emitUnary(OpCodes.LDLG, annotation.slot);
    } else {
      this.builder.emitBinary(OpCodes.LDPG, annotation.slot, annotation.envLevel);
    }
    return { maxStackSize: 1 };
  }

  private emitStoreSymbol(token: Token): void {
    const annotation = this.getTokenAnnotation(token);

    if (annotation.isPrimitive || annotation.isInternal) {
      throw new Error(`Cannot assign to primitive symbol: ${token.lexeme}`);
    }

    if (annotation.envLevel === 0) {
      this.builder.emitUnary(OpCodes.STLG, annotation.slot);
    } else {
      this.builder.emitBinary(OpCodes.STPG, annotation.slot, annotation.envLevel);
    }
  }

  private emitFunctionCall(token: Token, numArgs: number): void {
    const annotation = this.getTokenAnnotation(token);

    if (annotation.isInternal) {
      const internalOpcode = this.isTailCall ? OpCodes.CALLTV : OpCodes.CALLV;
      this.builder.emitPrimitiveCall(internalOpcode, annotation.internalIndex!, numArgs);
    } else if (annotation.isPrimitive) {
      const primitiveOpcode = this.isTailCall ? OpCodes.CALLTP : OpCodes.CALLP;
      this.builder.emitPrimitiveCall(primitiveOpcode, annotation.primitiveIndex!, numArgs);
    } else {
      const userOpcode = this.isTailCall ? OpCodes.CALLT : OpCodes.CALL;
      this.builder.emitCall(userOpcode, numArgs);
    }
  }

  visitLiteralExpr(expr: ExprNS.Literal): ExpressionResult {
    const value = expr.value;

    if (value === null) {
      this.builder.emitNullary(OpCodes.LGCN);
    } else {
      switch (typeof value) {
        case "boolean":
          this.builder.emitNullary(value ? OpCodes.LGCB1 : OpCodes.LGCB0);
          break;
        case "number":
          if (Number.isInteger(value) && I32_MIN <= value && value <= I32_MAX) {
            this.builder.emitUnary(OpCodes.LGCI, value);
          } else {
            this.builder.emitUnary(OpCodes.LGCF64, value);
          }
          break;
        case "string":
          this.builder.emitUnary(OpCodes.LGCS, value);
          break;
        default:
          throw new Error("Unsupported literal type");
      }
    }

    return { maxStackSize: 1 };
  }

  visitStarredExpr(_expr: ExprNS.Starred): ExpressionResult {
    throw new Error("Starred expressions not yet supported in PVML compiler");
  }

  visitBigIntLiteralExpr(expr: ExprNS.BigIntLiteral): ExpressionResult {
    const numValue = Number(expr.value);
    if (Number.isInteger(numValue) && I32_MIN <= numValue && numValue <= I32_MAX) {
      this.builder.emitUnary(OpCodes.LGCI, numValue);
    } else {
      this.builder.emitUnary(OpCodes.LGCF64, numValue);
    }

    return { maxStackSize: 1 };
  }

  visitComplexExpr(_expr: ExprNS.Complex): ExpressionResult {
    // TODO: needs proper PVML support for complex numbers
    throw new Error("Complex numbers not yet supported in PVML compiler");
  }

  visitListExpr(expr: ExprNS.List): ExpressionResult {
    const n = expr.elements.length;
    // Spill to a named slot because PVML has no direct stack-to-array-store
    const tmpSlot = this.getOrAssignSlot(
      this.currentEnvironment,
      `__list_tmp_${this.tmpCounter++}`,
    );

    // NEWA takes no size operand: native Pynter's op_new_a always creates an
    // empty, auto-growing array (siarray_new(8) with count=0) and ignores
    // whatever's on the stack — it never pops a size. Pushing one here (as
    // this used to) left it stranded on the stack after NEWA, permanently
    // corrupting stack balance for the rest of the program (every list
    // literal leaked one value, eventually manifesting as a native stack
    // overflow). STAG (via siarray_put) grows the array to fit as elements
    // are stored below.
    this.builder.emitNullary(OpCodes.NEWA);
    this.builder.emitUnary(OpCodes.STLG, tmpSlot);

    for (let i = 0; i < n; i++) {
      this.builder.emitUnary(OpCodes.LDLG, tmpSlot);
      this.builder.emitUnary(OpCodes.LGCI, i);
      this.compile(expr.elements[i]);
      this.builder.emitNullary(OpCodes.STAG);
    }

    this.builder.emitUnary(OpCodes.LDLG, tmpSlot);

    return { maxStackSize: 3 + 1 };
  }

  visitSubscriptExpr(expr: ExprNS.Subscript): ExpressionResult {
    this.compile(expr.value);
    this.compile(expr.index);
    this.builder.emitNullary(OpCodes.LDAG);
    return { maxStackSize: 2 };
  }

  visitVariableExpr(expr: ExprNS.Variable): ExpressionResult {
    this.emitLoadSymbol(expr.name);
    return { maxStackSize: 1 };
  }

  private getBinaryOpCode(operator: Token): number {
    switch (operator.type) {
      case TokenType.PLUS:
        return OpCodes.ADDG;
      case TokenType.MINUS:
        return OpCodes.SUBG;
      case TokenType.STAR:
        return OpCodes.MULG;
      case TokenType.SLASH:
        return OpCodes.DIVG;
      case TokenType.PERCENT:
        return OpCodes.MODG;
      case TokenType.DOUBLESLASH:
        return OpCodes.FLOORDIVG;
      default:
        throw new Error(`Unsupported binary operator: ${operator.lexeme}`);
    }
  }

  private getCompareOpCode(operator: Token): number {
    switch (operator.type) {
      case TokenType.LESS:
        return OpCodes.LTG;
      case TokenType.GREATER:
        return OpCodes.GTG;
      case TokenType.LESSEQUAL:
        return OpCodes.LEG;
      case TokenType.GREATEREQUAL:
        return OpCodes.GEG;
      case TokenType.DOUBLEEQUAL:
        return OpCodes.EQG;
      case TokenType.NOTEQUAL:
        return OpCodes.NEQG;
      default:
        throw new Error(`Unsupported comparison operator: ${operator.lexeme}`);
    }
  }

  private compileBinOp(left: ExprNS.Expr, right: ExprNS.Expr, opcode: number): ExpressionResult {
    const leftResult = this.compile(left);
    const rightResult = this.compile(right);
    this.builder.emitNullary(opcode);
    return {
      maxStackSize: Math.max(leftResult.maxStackSize, 1 + rightResult.maxStackSize),
    };
  }

  visitBinaryExpr(expr: ExprNS.Binary): ExpressionResult {
    return this.compileBinOp(expr.left, expr.right, this.getBinaryOpCode(expr.operator));
  }

  visitCompareExpr(expr: ExprNS.Compare): ExpressionResult {
    return this.compileBinOp(expr.left, expr.right, this.getCompareOpCode(expr.operator));
  }

  visitBoolOpExpr(expr: ExprNS.BoolOp): ExpressionResult {
    if (expr.operator.type === TokenType.AND) {
      // left && right -> left ? right : false
      const testResult = this.compile(expr.left);
      const elseLabel = this.builder.emitJump(OpCodes.BRF);

      const conseqResult = this.compile(expr.right);
      const endLabel = this.builder.emitJump(OpCodes.BR);

      this.builder.markLabel(elseLabel);
      this.builder.emitNullary(OpCodes.LGCB0);
      const altResult = { maxStackSize: 1 };

      this.builder.markLabel(endLabel);

      return {
        maxStackSize: Math.max(
          testResult.maxStackSize,
          conseqResult.maxStackSize,
          altResult.maxStackSize,
        ),
      };
    } else if (expr.operator.type === TokenType.OR) {
      // left || right -> left ? true : right
      const testResult = this.compile(expr.left);
      const elseLabel = this.builder.emitJump(OpCodes.BRF);

      this.builder.emitNullary(OpCodes.LGCB1);
      const conseqResult = { maxStackSize: 1 };
      const endLabel = this.builder.emitJump(OpCodes.BR);

      this.builder.markLabel(elseLabel);
      const altResult = this.compile(expr.right);

      this.builder.markLabel(endLabel);

      return {
        maxStackSize: Math.max(
          testResult.maxStackSize,
          conseqResult.maxStackSize,
          altResult.maxStackSize,
        ),
      };
    }
    throw new Error(`Unsupported boolean operator: ${expr.operator.lexeme}`);
  }

  visitUnaryExpr(expr: ExprNS.Unary): ExpressionResult {
    let opcode: number;

    switch (expr.operator.type) {
      case TokenType.NOT:
        opcode = OpCodes.NOTG;
        break;
      case TokenType.MINUS:
        opcode = OpCodes.NEGG;
        break;
      case TokenType.PLUS:
        return this.compile(expr.right);
      default:
        throw new Error(`Unsupported unary operator: ${expr.operator.lexeme}`);
    }

    const operandResult = this.compile(expr.right);
    this.builder.emitNullary(opcode);

    return { maxStackSize: operandResult.maxStackSize };
  }

  visitCallExpr(expr: ExprNS.Call): ExpressionResult {
    if (!(expr.callee instanceof ExprNS.Variable)) {
      throw new Error("Unsupported call expression: callee must be an identifier");
    }

    const callee: ExprNS.Variable = expr.callee;

    // CALLP/CALLTP (primitive calls) and CALLV/CALLTV (VM-internal calls)
    // take their arguments directly off the stack with no function value
    // involved (see callPrimitive/callInternal) — only a non-primitive,
    // non-internal (closure) call needs its callee's value loaded first.
    // Loading it here regardless would push a stray NEWCP/NEWCV value that
    // CALLP/CALLV never consumes, corrupting the stack for every such call.
    const calleeAnnotation = this.getTokenAnnotation(callee.name);
    const isDirectDispatchCallee = calleeAnnotation.isPrimitive || calleeAnnotation.isInternal;
    const functionStackEffect = isDirectDispatchCallee
      ? 0
      : this.emitLoadSymbol(callee.name).maxStackSize;

    let maxArgStackSize = 0;
    for (let i = 0; i < expr.args.length; i++) {
      const argResult = this.compile(expr.args[i]);
      maxArgStackSize = Math.max(maxArgStackSize, i + argResult.maxStackSize);
    }

    const numArgs = expr.args.length;
    this.emitFunctionCall(callee.name, numArgs);

    return {
      maxStackSize: functionStackEffect + maxArgStackSize,
    };
  }

  visitTernaryExpr(expr: ExprNS.Ternary): ExpressionResult {
    const testResult = this.compile(expr.predicate);
    const elseLabel = this.builder.emitJump(OpCodes.BRF);

    const conseqResult = this.compile(expr.consequent);
    const endLabel = this.builder.emitJump(OpCodes.BR);

    this.builder.markLabel(elseLabel);
    const altResult = this.compile(expr.alternative);

    this.builder.markLabel(endLabel);

    return {
      maxStackSize: Math.max(
        testResult.maxStackSize,
        conseqResult.maxStackSize,
        altResult.maxStackSize,
      ),
    };
  }

  visitNoneExpr(_expr: ExprNS.None): ExpressionResult {
    this.builder.emitNullary(OpCodes.LGCN);
    return { maxStackSize: 1 };
  }

  /** Compile a closure body, emit RETG, and emit NEWC in the parent scope. */
  private compileClosure(
    node: StmtNS.FunctionDef | ExprNS.Lambda | ExprNS.MultiLambda,
    compileBody: (compiler: PVMLCompiler) => ExpressionResult,
  ): ExpressionResult {
    const compiler = this.fromFunctionNode(node);
    const { maxStackSize } = compileBody(compiler);
    // Falling off the end of a function body without hitting an explicit
    // `return` yields None in Python, regardless of what the last statement
    // happened to leave on the stack for compileStatements' stack-balance
    // bookkeeping (a real value for a bare expression statement, or an
    // internal `undefined` placeholder for e.g. an assignment) — discard it
    // and return Python's None explicitly. An explicit `return` elsewhere in
    // the body (visitReturnStmt) emits its own RETG and exits before ever
    // reaching this point, so this only fires on true fallthrough.
    compiler.builder.emitNullary(OpCodes.POPG);
    compiler.builder.emitNullary(OpCodes.LGCN);
    compiler.builder.emitNullary(OpCodes.RETG);
    this.builder.emitUnary(OpCodes.NEWC, compiler.builder.getFunctionIndex());
    return { maxStackSize: Math.max(maxStackSize, 1) };
  }

  visitLambdaExpr(expr: ExprNS.Lambda): ExpressionResult {
    const ast = new StmtNS.Return(expr.startToken, expr.endToken, expr.body);
    return this.compileClosure(expr, c => c.compile(ast));
  }

  visitMultiLambdaExpr(expr: ExprNS.MultiLambda): ExpressionResult {
    return this.compileClosure(expr, c => c.compileStatements(expr.body));
  }

  visitGroupingExpr(expr: ExprNS.Grouping): ExpressionResult {
    return this.compile(expr.expression);
  }

  visitSimpleExprStmt(stmt: StmtNS.SimpleExpr): ExpressionResult {
    return this.compile(stmt.expression);
  }

  visitReturnStmt(stmt: StmtNS.Return): ExpressionResult {
    if (!stmt.value) {
      // Bare `return` (no expression) yields Python's None, not `undefined`
      // — LGCN, not LGCU (LGCU is an internal stack-balance placeholder, not
      // a real Python value; see compileClosure).
      this.builder.emitNullary(OpCodes.LGCN);
      this.builder.emitNullary(OpCodes.RETG);
      return { maxStackSize: 1 };
    }
    const result = this.compile(stmt.value);
    this.builder.emitNullary(OpCodes.RETG);
    return result;
  }

  visitAssignStmt(stmt: StmtNS.Assign): ExpressionResult {
    if (stmt.target instanceof ExprNS.Subscript) {
      const arrResult = this.compile(stmt.target.value);
      const idxResult = this.compile(stmt.target.index);
      const valResult = this.compile(stmt.value);
      this.builder.emitNullary(OpCodes.STAG);
      this.builder.emitNullary(OpCodes.LGCU);
      return {
        maxStackSize: Math.max(
          arrResult.maxStackSize,
          1 + idxResult.maxStackSize,
          2 + valResult.maxStackSize,
          1,
        ),
      };
    }

    const initResult = this.compile(stmt.value);

    this.emitStoreSymbol(stmt.target.name);

    this.builder.emitNullary(OpCodes.LGCU);
    return initResult;
  }

  visitFunctionDefStmt(stmt: StmtNS.FunctionDef): ExpressionResult {
    const result = this.compileClosure(stmt, c => c.compileStatements(stmt.body));
    this.emitStoreSymbol(stmt.name);
    this.builder.emitNullary(OpCodes.LGCU);
    return result;
  }

  visitIfStmt(stmt: StmtNS.If): ExpressionResult {
    const testResult = this.compile(stmt.condition);
    const elseLabel = this.builder.emitJump(OpCodes.BRF);

    const conseqResult = this.compileStatements(stmt.body);
    const endLabel = this.builder.emitJump(OpCodes.BR);

    this.builder.markLabel(elseLabel);
    const altResult = stmt.elseBlock
      ? this.compileStatements(stmt.elseBlock)
      : (() => {
          this.builder.emitNullary(OpCodes.LGCU);
          return { maxStackSize: 1 };
        })();

    this.builder.markLabel(endLabel);

    return {
      maxStackSize: Math.max(
        testResult.maxStackSize,
        conseqResult.maxStackSize,
        altResult.maxStackSize,
      ),
    };
  }

  visitWhileStmt(stmt: StmtNS.While): ExpressionResult {
    const loopLabel = this.builder.markLabel();
    const endLabel = this.builder.getNextLabel();

    this.loopStack.push({
      breakLabel: endLabel,
      continueLabel: loopLabel,
      iteratorOnStack: false,
    });

    const testResult = this.compile(stmt.condition);
    this.builder.emitJump(OpCodes.BRF, endLabel);

    const bodyResult = this.compileStatements(stmt.body);
    // Body values aren't used; discard to maintain stack balance
    this.builder.emitNullary(OpCodes.POPG);
    this.builder.emitJump(OpCodes.BR, loopLabel);

    this.loopStack.pop();

    this.builder.markLabel(endLabel);
    this.builder.emitNullary(OpCodes.LGCU);

    return {
      maxStackSize: Math.max(testResult.maxStackSize, bodyResult.maxStackSize, 1),
    };
  }

  visitPassStmt(_stmt: StmtNS.Pass): ExpressionResult {
    this.builder.emitNullary(OpCodes.LGCU);
    return { maxStackSize: 1 };
  }

  visitAnnAssignStmt(_stmt: StmtNS.AnnAssign): ExpressionResult {
    throw new Error("AnnAssign not yet implemented in PVML compiler");
  }

  visitBreakStmt(_stmt: StmtNS.Break): ExpressionResult {
    if (this.loopStack.length === 0) {
      throw new Error("Break statement outside loop");
    }
    const { breakLabel, iteratorOnStack } = this.loopStack[this.loopStack.length - 1];
    if (iteratorOnStack) {
      this.builder.emitNullary(OpCodes.POPG); // drop iterator
    }
    this.builder.emitJump(OpCodes.BR, breakLabel);
    return { maxStackSize: 0 };
  }

  visitContinueStmt(_stmt: StmtNS.Continue): ExpressionResult {
    if (this.loopStack.length === 0) {
      throw new Error("Continue statement outside loop");
    }
    const { continueLabel } = this.loopStack[this.loopStack.length - 1];
    this.builder.emitJump(OpCodes.BR, continueLabel);
    return { maxStackSize: 0 };
  }

  visitFromImportStmt(_stmt: StmtNS.FromImport): ExpressionResult {
    throw new Error("FromImport not yet implemented in PVML compiler");
  }

  visitGlobalStmt(_stmt: StmtNS.Global): ExpressionResult {
    this.builder.emitNullary(OpCodes.LGCU);
    return { maxStackSize: 1 };
  }

  visitNonLocalStmt(_stmt: StmtNS.NonLocal): ExpressionResult {
    this.builder.emitNullary(OpCodes.LGCU);
    return { maxStackSize: 1 };
  }

  visitAssertStmt(_stmt: StmtNS.Assert): ExpressionResult {
    throw new Error("Assert not yet implemented in PVML compiler");
  }

  visitForStmt(stmt: StmtNS.For): ExpressionResult {
    this.compile(stmt.iter);
    this.builder.emitNullary(OpCodes.NEWITER);

    const loopStartLabel = this.builder.markLabel();
    const loopEndLabel = this.builder.getNextLabel();

    this.loopStack.push({
      breakLabel: loopEndLabel,
      continueLabel: loopStartLabel,
      iteratorOnStack: true,
    });

    // FOR_ITER: if exhausted, pops iter and jumps to loopEnd; else pushes next value
    this.builder.emitJump(OpCodes.FOR_ITER, loopEndLabel);

    // Iterator stays on stack below the value
    const targetSlot = this.getOrAssignSlot(this.currentEnvironment, stmt.target.lexeme);
    this.builder.emitUnary(OpCodes.STLG, targetSlot);

    const bodyResult = this.compileStatements(stmt.body);
    // Body values aren't used; discard to maintain stack balance
    this.builder.emitNullary(OpCodes.POPG);

    this.builder.emitJump(OpCodes.BR, loopStartLabel);

    this.loopStack.pop();

    // Iterator already popped by FOR_ITER on exhaustion
    this.builder.markLabel(loopEndLabel);
    this.builder.emitNullary(OpCodes.LGCU);

    return { maxStackSize: Math.max(bodyResult.maxStackSize + 2, 2) };
  }

  visitFileInputStmt(stmt: StmtNS.FileInput): ExpressionResult {
    const { maxStackSize } = this.compileStatements(stmt.statements);
    this.builder.emitNullary(OpCodes.RETG);
    return { maxStackSize: Math.max(maxStackSize, 1) };
  }

  compileStatements(statements: StmtNS.Stmt[]): ExpressionResult {
    if (statements.length === 0) {
      this.builder.emitNullary(OpCodes.LGCU);
      return { maxStackSize: 1 };
    }

    let maxStackSize = 0;

    for (let i = 0; i < statements.length; i++) {
      const result = this.compile(statements[i]);
      maxStackSize = Math.max(maxStackSize, result.maxStackSize);

      // Assumption: every statement/expression leaves exactly one value.
      // Earlier statement results are not needed and would otherwise accumulate,
      // breaking block-level stack balance. Pop N-1 intermediates so only the last
      // statement's value remains (the block result). Any leftovers indicate a
      // compiler emission bug (e.g. extra LGCU or unconsumed operands).
      if (i < statements.length - 1) {
        this.builder.emitNullary(OpCodes.POPG);
      }
    }

    return { maxStackSize };
  }
}
