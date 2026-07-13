import { ExprNS, StmtNS } from "../../ast-types";
import { Environment, FunctionEnvironments, Resolver } from "../../resolver";
import math from "../../stdlib/math";
import misc from "../../stdlib/misc";
import { Token, TokenType } from "../../tokenizer";
import { PVMLIRBuilder } from "./PVMLIRBuilder";
import { PRIMITIVE_CONSTANTS, PRIMITIVE_FUNCTIONS } from "./builtins";
import OpCodes from "./opcodes";
import { PVMLProgram } from "./types";

/** Signed 32-bit integer bounds used to decide LGCI vs LGCF64 encoding. */
const I32_MIN = -2_147_483_648;
const I32_MAX = 2_147_483_647;

/** Primitive index of the compiler-internal `_concat_arrays` helper (see
 * builtins.ts's executePrimitive case 100) — never resolvable by name from
 * Python source (no PRIMITIVE_FUNCTIONS entry), only ever emitted directly
 * by compileSpreadCall. */
const CONCAT_ARRAYS_PRIMITIVE_INDEX = 100;

interface CompilerAnnotation {
  slot: number;
  envLevel: number;
  isPrimitive: boolean;
  primitiveIndex?: number;
  /** True for a name declared in the module-level environment, when the
   * compiler is in `useGlobalMap` mode — see PVMLCompiler.useGlobalMap and
   * getTokenAnnotation(). `slot`/`envLevel` are meaningless in this case;
   * `name` is what emitLoadSymbol/emitStoreSymbol emit LDGG/STGG with. */
  isGlobal?: boolean;
  name?: string;
  /** True for a named numeric constant from a stdlib group (e.g. `math_pi`)
   * — see PRIMITIVE_CONSTANTS' doc comment in builtins.ts. `slot`/`envLevel`
   * are meaningless here, like `isGlobal`; `constantValue` is what
   * emitLoadSymbol emits directly as an LGCF64 operand, bypassing the
   * primitive-function-call machinery entirely (a constant is never called). */
  isConstant?: boolean;
  constantValue?: number;
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
  /**
   * True immediately before compiling a Call (or Ternary) expression known
   * to be in tail position — i.e. its value is returned right away, with
   * nothing else left to do in this function call. Set *only* by
   * compileTail, which is the sole entry point for tail-position compiling
   * (see its doc comment for why the scoping has to be this narrow).
   * visitCallExpr/compileSpreadCall/emitFunctionCall capture this flag into
   * a local at their own entry and immediately reset the field to `false`
   * before compiling their own children (arguments, callee) — a call that
   * merely *appears inside* a tail-position expression (e.g. `g(x)` in
   * `return f(g(x))`) is never itself a tail call, and must not reuse the
   * current frame (CALLT's frame-reuse clears `currentFrame.stack`, which
   * would corrupt any still-pending operands).
   */
  private isTailCall: boolean;
  /** The Python chapter being compiled for (1-4). Determines which of the
   * §1/§2- vs §3/§4-specific comparison opcodes getCompareOpCode() emits (see
   * opcodes.ts) — the compiler bakes the chapter's rules into the choice of
   * opcode so the interpreter/VM never needs a runtime "which chapter is
   * this" check. Threaded through to every child compiler (fromFunctionNode)
   * so a nested function/lambda compiles for the same chapter as its parent. */
  private readonly variant: number;
  /** When true, names declared at module level compile to LDGG/STGG (a
   * dynamically-growable, name-indexed global store) instead of the usual
   * fixed-slot LDPG/STPG. Off by default — native Pynter's single-shot
   * prelude+script compilation never needs globals to grow after the fact,
   * so it keeps using the plain slot-based module environment unchanged;
   * only py-slang's own PVMLInterpreter opts in, for its incremental/
   * persistent (browser REPL) use case, where a later chunk can introduce a
   * global a fixed-size array wouldn't have room for. Threaded through to
   * every child compiler (fromFunctionNode), same as `variant`. */
  private readonly useGlobalMap: boolean;
  /** When true, Python `int` literals compile to the old int32-range-LGCI /
   * LGCF64-fallback encoding (indistinguishable from a float once on the
   * stack) instead of always going through the bigint constant pool (LGCBI).
   * Native Pynter's single-shot, embedded/32-bit-target compilation is the
   * only caller that sets this — its NaN-boxed value representation already
   * distinguishes int from float at the VM level (NANBOX_TINT), and its
   * fixed-width binary format can't carry arbitrary-precision constants at
   * all (see opcodes.ts's LGCBI doc comment), so there is nothing for it to
   * gain from LGCBI and no way to serialise it if it tried. Every other
   * caller (py-slang's own PVMLInterpreter, the "full power of the desktop
   * browser" target) keeps the default `false`, matching the CSE machine's
   * own int/float (bigint/number) split. Threaded through to every child
   * compiler (fromFunctionNode), same as `variant`/`useGlobalMap`. */
  private readonly targetsPynter: boolean;

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
    variant: number,
    useGlobalMap: boolean = false,
    targetsPynter: boolean = false,
    tokenAnnotations: WeakMap<Token, CompilerAnnotation> = new WeakMap(),
    envSlotCounters: WeakMap<Environment, number> = new WeakMap(),
    envSlotMaps: WeakMap<Environment, Map<string, number>> = new WeakMap(),
    envBuilders: WeakMap<Environment, PVMLIRBuilder> = new WeakMap(),
  ) {
    this.builder = builder;
    this.currentEnvironment = currentEnvironment;
    this.functionEnvironments = functionEnvironments;
    this.isTailCall = false;
    this.variant = variant;
    this.useGlobalMap = useGlobalMap;
    this.targetsPynter = targetsPynter;
    this.tokenAnnotations = tokenAnnotations;
    this.envSlotCounters = envSlotCounters;
    this.envSlotMaps = envSlotMaps;
    this.envBuilders = envBuilders;
    this.envBuilders.set(currentEnvironment, builder);
  }

  /**
   * Create PVMLCompiler from program AST.
   * Pass pre-computed environments (from analyzeWithEnvironments) to avoid a second resolver run.
   */
  static fromProgram(
    program: StmtNS.FileInput,
    variant: number,
    functionEnvironments?: FunctionEnvironments,
    useGlobalMap: boolean = false,
    targetsPynter: boolean = false,
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
      variant,
      useGlobalMap,
      targetsPynter,
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
    // Display-only name for str()/repr() on a closure over this function
    // (see PVMLIR's `functionName` doc comment) — a FunctionDef's declared
    // name, or "(anonymous)" for a lambda/multi-lambda, matching how the CSE
    // machine names these (src/stdlib/utils.ts's toPythonString).
    const functionName = node instanceof StmtNS.FunctionDef ? node.name.lexeme : "(anonymous)";
    // A rest param (`def f(a, *rest)`) must be the closure's *last*
    // parameter — see PVMLIR's `hasRestParam` doc comment, whose whole
    // encoding (numArgs - 1 fixed params, the last slot absorbing every
    // remaining argument) assumes this. Unlike real Python, PVML has no
    // notion of a keyword-only parameter at all (there's no keyword-argument
    // call syntax to bind one), so `def f(x, *args, z): ...` — legal Python,
    // making `z` keyword-only — isn't a smaller PVML feature gap to close;
    // it's simply not expressible here. Reject it at compile time rather
    // than silently mis-splitting parameters (`hasRestParam` used to key
    // only off "is *any* parameter starred", which for a case like this
    // treated the trailing `z` as the rest param instead of `args`).
    const starredIndex = node.parameters.findIndex(p => p.isStarred);
    const hasRestParam = starredIndex !== -1;
    if (hasRestParam && starredIndex !== node.parameters.length - 1) {
      throw new Error(
        "A rest parameter (*args) must be the last parameter — PVML has no keyword-only parameters",
      );
    }
    if (hasRestParam && this.targetsPynter) {
      throw new Error("Rest parameters (*args) are not supported when compiling for native Pynter");
    }
    const builder = this.builder.createChildBuilder(numArgs, functionName, hasRestParam);

    const compiler = new PVMLCompiler(
      nextEnvironment,
      this.functionEnvironments,
      builder,
      this.variant,
      this.useGlobalMap,
      this.targetsPynter,
      this.tokenAnnotations,
      this.envSlotCounters,
      this.envSlotMaps,
      this.envBuilders,
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

    // The absolute-root environment (no enclosing scope at all) holds
    // builtins/prelude names, dispatched by primitive index — never a
    // fixed-slot or (in useGlobalMap mode) name-indexed variable lookup.
    const isPrimitiveEnv = parentEnv !== null && parentEnv.enclosing === null;
    // One level below the absolute root is the module-level environment —
    // Python's global scope (see resolver.ts's isModuleLevel check, which
    // uses the same test). In useGlobalMap mode this is where LDGG/STGG take
    // over from the fixed-slot LDPG/STPG the "Pynter mode" (useGlobalMap
    // false) keeps using — see the `useGlobalMap` field doc comment.
    const isModuleLevelEnv =
      this.useGlobalMap &&
      parentEnv !== null &&
      parentEnv.enclosing !== null &&
      parentEnv.enclosing.enclosing === null;

    // `__program__` (the running script's own source text — see
    // PVMLInterpreter's `programText` constructor option) sits in the
    // resolver's absolute-root names map alongside every other builtin (see
    // resolver.ts's initial `moduleNames`), so it would otherwise hit
    // isPrimitiveEnv below and fail as an unregistered primitive: unlike
    // every other root-level name, its value isn't known until the
    // interpreter actually runs (it's the literal source text of whichever
    // chunk is executing), so it can't be a PRIMITIVE_FUNCTIONS/
    // PRIMITIVE_CONSTANTS entry — it's injected into globalEnv at runtime
    // instead, the same LDGG mechanism as any other useGlobalMap-mode global.
    if (this.useGlobalMap && name === "__program__") {
      annotation = { slot: -1, envLevel: -1, isPrimitive: false, isGlobal: true, name };
    } else if (isPrimitiveEnv) {
      const constantValue = PRIMITIVE_CONSTANTS.get(name);
      if (constantValue !== undefined) {
        annotation = {
          slot: -1,
          envLevel: -1,
          isPrimitive: false,
          isConstant: true,
          constantValue,
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
    } else if (isModuleLevelEnv) {
      annotation = {
        slot: -1,
        envLevel: -1,
        isPrimitive: false,
        isGlobal: true,
        name,
      };
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

    if (annotation.isConstant) {
      // A named numeric constant (e.g. `math_pi`) — pushed directly as a
      // float, bypassing the primitive-function-call machinery entirely
      // (see PRIMITIVE_CONSTANTS' doc comment in builtins.ts).
      this.builder.emitUnary(OpCodes.LGCF64, annotation.constantValue);
      return { maxStackSize: 1 };
    }
    if (annotation.isPrimitive) {
      // A primitive referenced as a value rather than called directly (e.g.
      // `is_function(print)`, `f = abs`) — NEWCP pushes a callable reference
      // to it, mirroring native Pynter's "ifn" nanbox tag. A direct call
      // (`print(x)`) never reaches this branch: emitFunctionCall emits
      // CALLP/CALLTP straight from the primitive index instead.
      this.builder.emitUnary(OpCodes.NEWCP, annotation.primitiveIndex);
      return { maxStackSize: 1 };
    }
    if (annotation.isGlobal) {
      this.builder.emitUnary(OpCodes.LDGG, annotation.name);
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

    if (annotation.isConstant) {
      throw new Error(`Cannot assign to constant symbol: ${token.lexeme}`);
    }
    if (annotation.isPrimitive) {
      throw new Error(`Cannot assign to primitive symbol: ${token.lexeme}`);
    }

    if (annotation.isGlobal) {
      this.builder.emitUnary(OpCodes.STGG, annotation.name);
      return;
    }

    if (annotation.envLevel === 0) {
      this.builder.emitUnary(OpCodes.STLG, annotation.slot);
    } else {
      this.builder.emitBinary(OpCodes.STPG, annotation.slot, annotation.envLevel);
    }
  }

  private emitFunctionCall(token: Token, numArgs: number, isTailCall: boolean): void {
    const annotation = this.getTokenAnnotation(token);

    if (annotation.isPrimitive) {
      const primitiveOpcode = isTailCall ? OpCodes.CALLTP : OpCodes.CALLP;
      this.builder.emitPrimitiveCall(primitiveOpcode, annotation.primitiveIndex!, numArgs);
    } else {
      const userOpcode = isTailCall ? OpCodes.CALLT : OpCodes.CALL;
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
    // A Starred expression as a direct call argument (`f(*xs)`) is handled
    // entirely by visitCallExpr/compileSpreadCall, without ever visiting the
    // node through here — that's the only place `*expr` syntax is valid in
    // this language (no tuple-unpacking assignment targets exist at all, see
    // AssignTarget in ast-types.ts), so reaching this method at all means a
    // bare/standalone spread outside a call's argument list, which is a
    // syntax error.
    throw new Error("Starred expressions are only supported as call arguments (f(*xs))");
  }

  visitBigIntLiteralExpr(expr: ExprNS.BigIntLiteral): ExpressionResult {
    if (this.targetsPynter) {
      const numValue = Number(expr.value);
      if (Number.isInteger(numValue) && I32_MIN <= numValue && numValue <= I32_MAX) {
        this.builder.emitUnary(OpCodes.LGCI, numValue);
      } else {
        this.builder.emitUnary(OpCodes.LGCF64, numValue);
      }
    } else {
      // Always preserve full precision and the int/float distinction — see
      // `targetsPynter`'s doc comment and opcodes.ts's LGCBI doc comment.
      // `expr.value` is the literal's raw digit string (BigIntLiteral.value),
      // not yet a JS bigint — emitUnary's string-vs-bigint dispatch relies on
      // actually passing a `bigint` here, not a numeric string.
      this.builder.emitUnary(OpCodes.LGCBI, BigInt(expr.value));
    }

    return { maxStackSize: 1 };
  }

  visitComplexExpr(expr: ExprNS.Complex): ExpressionResult {
    if (this.targetsPynter) {
      // Native Pynter has zero complex-number support (no NaN-boxing tag, no
      // arithmetic) and never will — see opcodes.ts's LGCC doc comment. Fail
      // at compile time with a clear message rather than emitting an opcode
      // that would only be caught later, opaquely, by assemble()'s
      // targetMaxOpcode check.
      throw new Error("Complex number literals are not supported when compiling for native Pynter");
    }
    this.builder.emitUnary(OpCodes.LGCC, expr.value);
    return { maxStackSize: 1 };
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
      case TokenType.DOUBLESTAR:
        return OpCodes.POWG;
      default:
        throw new Error(`Unsupported binary operator: ${operator.lexeme}`);
    }
  }

  /**
   * `==`/`!=`/ordering mean different things at §1/§2 (bool — and for `==`/`!=`,
   * function — operands are rejected outright: docs/specs/python_typing_middle_12.tex)
   * vs §3/§4 (bool participates as the int it is, no exclusions:
   * python_typing_middle_34.tex). Rather than have the VM ask "which chapter is
   * this program?" at runtime, the compiler bakes that choice into which of the
   * two opcode families it emits — see the EQG12/NEQG12/LTG12/GTG12/LEG12/GEG12
   * comment in opcodes.ts.
   */
  private getCompareOpCode(operator: Token): number {
    const restricted = this.variant <= 2;
    switch (operator.type) {
      case TokenType.LESS:
        return restricted ? OpCodes.LTG12 : OpCodes.LTG;
      case TokenType.GREATER:
        return restricted ? OpCodes.GTG12 : OpCodes.GTG;
      case TokenType.LESSEQUAL:
        return restricted ? OpCodes.LEG12 : OpCodes.LEG;
      case TokenType.GREATEREQUAL:
        return restricted ? OpCodes.GEG12 : OpCodes.GEG;
      case TokenType.DOUBLEEQUAL:
        return restricted ? OpCodes.EQG12 : OpCodes.EQG;
      case TokenType.NOTEQUAL:
        return restricted ? OpCodes.NEQG12 : OpCodes.NEQG;
      // `is`/`is not` only exist at §3/§4 at all (rejected at §1/§2 by
      // NoIsOperatorValidator before compilation ever starts), so there's no
      // chapter-gated opcode choice to make here. They test identity (Python
      // pointer equality), a different question from `==`/`!=`'s structural
      // equality — e.g. two separately-constructed but element-wise-equal
      // lists are `==` but not `is`. They therefore get their own opcodes
      // rather than reusing EQG/NEQG.
      case TokenType.IS:
        return OpCodes.EQP;
      case TokenType.ISNOT:
        return OpCodes.NEQP;
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

  /** Compiles a call's argument list left to right, returning the peak extra
   * stack depth they need (relative to whatever's already on the stack —
   * e.g. a callee value — when the first argument starts compiling). Shared
   * by both branches of visitCallExpr. */
  private compileCallArgs(args: ExprNS.Expr[]): number {
    let maxArgStackSize = 0;
    for (let i = 0; i < args.length; i++) {
      const argResult = this.compile(args[i]);
      maxArgStackSize = Math.max(maxArgStackSize, i + argResult.maxStackSize);
    }
    return maxArgStackSize;
  }

  visitCallExpr(expr: ExprNS.Call): ExpressionResult {
    // Capture-and-clear: this call's own tail-ness is whatever the ambient
    // flag was on entry, but compiling its callee/arguments below must not
    // see it — a nested call inside an argument (`f(g(x))`) or a computed
    // callee is never itself in tail position. See isTailCall's doc comment.
    const isTail = this.isTailCall;
    this.isTailCall = false;

    if (expr.args.some(arg => arg instanceof ExprNS.Starred)) {
      // A spread argument (`f(*xs)`) makes the actual argument count runtime-
      // variable, independent of whether the callee is a statically-known
      // name — a spread call to a known function still needs CALLA/CALLTA,
      // not the CALLP/CALL fast path below.
      return this.compileSpreadCall(expr, isTail);
    }

    if (expr.callee instanceof ExprNS.Variable) {
      const callee: ExprNS.Variable = expr.callee;

      // CALLP/CALLTP (primitive calls) take their arguments directly off the
      // stack with no function value involved (see callPrimitive) — only a
      // non-primitive (closure) call needs its callee's value loaded first.
      // Loading it here regardless would push a stray NEWCP value that CALLP
      // never consumes, corrupting the stack for every primitive call.
      const isPrimitiveCallee = this.getTokenAnnotation(callee.name).isPrimitive;
      const functionStackEffect = isPrimitiveCallee
        ? 0
        : this.emitLoadSymbol(callee.name).maxStackSize;

      const maxArgStackSize = this.compileCallArgs(expr.args);

      const numArgs = expr.args.length;
      this.emitFunctionCall(callee.name, numArgs, isTail);

      return {
        maxStackSize: functionStackEffect + maxArgStackSize,
      };
    }

    // General case: the callee is a computed expression (a call result, an
    // immediately-invoked lambda, a subscript, etc.), not a statically-known
    // name — push whatever it evaluates to (a closure, or a first-class
    // primitive reference), then dispatch via CALL/CALLT. There's no CALLP
    // fast path here (no compile-time-known primitive index to encode), but
    // the interpreter's dispatchCall already handles a runtime PVMLPrimitive
    // callee value dynamically — the same mechanism that already makes
    // `f = abs; f(-5)` work today.
    const calleeResult = this.compile(expr.callee);
    const maxArgStackSize = this.compileCallArgs(expr.args);

    const numArgs = expr.args.length;
    const userOpcode = isTail ? OpCodes.CALLT : OpCodes.CALL;
    this.builder.emitCall(userOpcode, numArgs);

    return {
      maxStackSize: calleeResult.maxStackSize + maxArgStackSize,
    };
  }

  /**
   * Compiles a call with at least one spread argument (`f(*xs)`, or a mix
   * like `f(a, *xs, b)`). `xs`'s length isn't known until runtime, but
   * CALL/CALLT's `numArgs` operand is a static instruction byte (and, being
   * ≤ PYNTER_OPCODE_MAX, its semantics can't change to accommodate this) —
   * so instead this builds one flat runtime args array and dispatches via
   * CALLA/CALLTA (see opcodes.ts's doc comment there).
   *
   * Each syntactic argument becomes one "piece": a plain argument is wrapped
   * in a fresh 1-element array (compileSingleElementArray); a spread
   * argument's value is used directly (it's already a Python list, i.e. a
   * PVMLArray). CONCAT_ARRAYS_PRIMITIVE_INDEX (see builtins.ts's
   * executePrimitive case 100) flattens all the pieces — however many there
   * are, whichever are spreads — into one array in a single CALLP, since the
   * *piece* count is always statically known even though the *flattened*
   * length isn't.
   */
  private compileSpreadCall(expr: ExprNS.Call, isTail: boolean): ExpressionResult {
    if (this.targetsPynter) {
      throw new Error(
        "Call-site argument spreading (*args) is not supported when compiling for native Pynter",
      );
    }

    const calleeResult = this.compile(expr.callee);

    let maxPieceStackSize = 0;
    for (let i = 0; i < expr.args.length; i++) {
      const arg = expr.args[i];
      const pieceResult =
        arg instanceof ExprNS.Starred
          ? this.compile(arg.value)
          : this.compileSingleElementArray(arg);
      maxPieceStackSize = Math.max(maxPieceStackSize, i + pieceResult.maxStackSize);
    }

    this.builder.emitPrimitiveCall(OpCodes.CALLP, CONCAT_ARRAYS_PRIMITIVE_INDEX, expr.args.length);

    const userOpcode = isTail ? OpCodes.CALLTA : OpCodes.CALLA;
    this.builder.emitNullary(userOpcode);

    return {
      maxStackSize: calleeResult.maxStackSize + maxPieceStackSize,
    };
  }

  /** Wraps a single compiled value in a fresh 1-element array — builds one
   * "piece" for compileSpreadCall's argument flattening. Same NEWA/STAG
   * pattern as visitListExpr, specialized to exactly one element. */
  private compileSingleElementArray(expr: ExprNS.Expr): ExpressionResult {
    const tmpSlot = this.getOrAssignSlot(
      this.currentEnvironment,
      `__spread_piece_${this.tmpCounter++}`,
    );
    this.builder.emitNullary(OpCodes.NEWA);
    this.builder.emitUnary(OpCodes.STLG, tmpSlot);

    this.builder.emitUnary(OpCodes.LDLG, tmpSlot);
    this.builder.emitUnary(OpCodes.LGCI, 0);
    const elemResult = this.compile(expr);
    this.builder.emitNullary(OpCodes.STAG);

    this.builder.emitUnary(OpCodes.LDLG, tmpSlot);

    return { maxStackSize: Math.max(2 + elemResult.maxStackSize, 1) };
  }

  visitTernaryExpr(expr: ExprNS.Ternary): ExpressionResult {
    // Captured once: whether this ternary itself is in tail position — only
    // ever true when reached via compileTail (see its doc comment). If so,
    // both branches are equally in tail position (whichever one executes is
    // the last thing the function does) and are compiled via compileTail
    // too, so a Call/Ternary nested in either branch is handled recursively.
    // A plain `this.compile(...)` call (the non-tail case, e.g. this ternary
    // is a call argument or an assignment's value) never sets isTailCall in
    // the first place, so nothing needs clearing here for that branch.
    const isTail = this.isTailCall;
    this.isTailCall = false;

    const testResult = this.compile(expr.predicate);
    const elseLabel = this.builder.emitJump(OpCodes.BRF);

    const conseqResult = isTail ? this.compileTail(expr.consequent) : this.compile(expr.consequent);
    const endLabel = this.builder.emitJump(OpCodes.BR);

    this.builder.markLabel(elseLabel);
    const altResult = isTail ? this.compileTail(expr.alternative) : this.compile(expr.alternative);

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
    // `return` yields None in Python. compileBody (compileStatements, for a
    // FunctionDef/MultiLambda; a single Return, for a Lambda) always leaves
    // the stack exactly as it found it on the fallthrough path — statements
    // other than a bare expression push nothing, and a bare expression
    // statement pushes its value only to immediately pop it again — so there
    // is nothing to discard here, just Python's None to push explicitly. An
    // explicit `return` elsewhere in the body (visitReturnStmt) emits its
    // own RETG and exits before ever reaching this point, so this only fires
    // on true fallthrough.
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
      // Bare `return` (no expression) yields Python's None explicitly.
      this.builder.emitNullary(OpCodes.LGCN);
      this.builder.emitNullary(OpCodes.RETG);
      return { maxStackSize: 1 };
    }
    // stmt.value is returned immediately with nothing left to do afterward —
    // the definition of tail position.
    const result = this.compileTail(stmt.value);
    this.builder.emitNullary(OpCodes.RETG);
    return result;
  }

  /**
   * Compiles `expr` knowing it is in tail position — its value is returned
   * immediately, with nothing else left to do in this function call. Called
   * only from visitReturnStmt (for its direct `value`) and recursively from
   * visitTernaryExpr's branches (whichever branch executes is equally the
   * last thing the function does).
   *
   * This is the *only* place that ever sets `isTailCall = true`, and only
   * immediately before dispatching directly into a Call (or Ternary, or a
   * Grouping wrapping one) — for every other expression shape (`f(x) + 1`,
   * `[f(x)]`, a bare variable, ...) it just calls the ordinary `compile()`,
   * leaving `isTailCall` at its default `false`. This narrow scoping is
   * deliberate: unlike Call/Ternary, most expression-compiling methods
   * (visitBinaryExpr, visitUnaryExpr, ...) have no reason to know about
   * isTailCall and don't clear it before compiling their own children — if
   * this method blindly set the flag for *any* stmt.value shape, it would
   * leak into e.g. `f(x)` inside `return f(x) + 1`, wrongly making a
   * non-tail call reuse the current frame (CALLT clears
   * `currentFrame.stack`, corrupting the pending `+ 1`).
   */
  private compileTail(expr: ExprNS.Expr): ExpressionResult {
    if (expr instanceof ExprNS.Grouping) {
      return this.compileTail(expr.expression);
    }
    if (expr instanceof ExprNS.Call || expr instanceof ExprNS.Ternary) {
      this.isTailCall = true;
      const result = this.compile(expr);
      this.isTailCall = false;
      return result;
    }
    return this.compile(expr);
  }

  // Assign is a statement, not an expression — like every other statement
  // (see compileStatements' doc comment), it leaves nothing on the stack:
  // STAG/STLG/STPG/STGG each pop exactly what the preceding sub-expressions
  // pushed (STAG: -3 for [array, index, value]; the plain-variable store
  // opcodes: -1 for [value]), netting to zero.
  visitAssignStmt(stmt: StmtNS.Assign): ExpressionResult {
    if (stmt.target instanceof ExprNS.Subscript) {
      const arrResult = this.compile(stmt.target.value);
      const idxResult = this.compile(stmt.target.index);
      const valResult = this.compile(stmt.value);
      this.builder.emitNullary(OpCodes.STAG);
      return {
        maxStackSize: Math.max(
          arrResult.maxStackSize,
          1 + idxResult.maxStackSize,
          2 + valResult.maxStackSize,
        ),
      };
    }

    const initResult = this.compile(stmt.value);
    this.emitStoreSymbol(stmt.target.name);
    return initResult;
  }

  visitFunctionDefStmt(stmt: StmtNS.FunctionDef): ExpressionResult {
    const result = this.compileClosure(stmt, c => c.compileStatements(stmt.body));
    this.emitStoreSymbol(stmt.name);
    return result;
  }

  // If is a statement, leaving nothing on the stack (see compileStatements'
  // doc comment) — both branches run through compileStatements, which
  // always nets to zero, so the two paths trivially agree on stack depth at
  // endLabel where they converge, with no placeholder value needed for a
  // missing else branch.
  visitIfStmt(stmt: StmtNS.If): ExpressionResult {
    const testResult = this.compile(stmt.condition);
    const elseLabel = this.builder.emitJump(OpCodes.BRF);

    const conseqResult = this.compileStatements(stmt.body);
    const endLabel = this.builder.emitJump(OpCodes.BR);

    this.builder.markLabel(elseLabel);
    const altResult = stmt.elseBlock ? this.compileStatements(stmt.elseBlock) : { maxStackSize: 0 };

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

    // compileStatements always nets to zero, so nothing to discard here.
    const bodyResult = this.compileStatements(stmt.body);
    this.builder.emitJump(OpCodes.BR, loopLabel);

    this.loopStack.pop();

    this.builder.markLabel(endLabel);

    return {
      maxStackSize: Math.max(testResult.maxStackSize, bodyResult.maxStackSize),
    };
  }

  visitPassStmt(_stmt: StmtNS.Pass): ExpressionResult {
    return { maxStackSize: 0 };
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
    // A genuine no-op, matching the CSE machine's own FromImport handler
    // (src/engines/cse/interpreter.ts): SICPy has no real per-file module
    // system — every stdlib group's names are preloaded into the global
    // scope by the runner/evaluator before any user code runs, so a name
    // this statement "imports" is already resolvable by the time it's used.
    // Emits nothing at all — like every statement (see compileStatements'
    // doc comment), it has no value to leave on the stack.
    return { maxStackSize: 0 };
  }

  visitGlobalStmt(_stmt: StmtNS.Global): ExpressionResult {
    return { maxStackSize: 0 };
  }

  visitNonLocalStmt(_stmt: StmtNS.NonLocal): ExpressionResult {
    return { maxStackSize: 0 };
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

    // Iterator stays on stack below the value. Routed through emitStoreSymbol
    // (not a hardcoded local-slot store) so a module-level `for` target
    // correctly uses STGG in useGlobalMap mode, exactly like any other
    // module-level assignment — see emitStoreSymbol/getTokenAnnotation.
    this.emitStoreSymbol(stmt.target);

    // compileStatements always nets to zero, so nothing to discard here.
    const bodyResult = this.compileStatements(stmt.body);

    this.builder.emitJump(OpCodes.BR, loopStartLabel);

    this.loopStack.pop();

    // Iterator already popped by FOR_ITER on exhaustion
    this.builder.markLabel(loopEndLabel);

    return { maxStackSize: Math.max(bodyResult.maxStackSize + 2, 2) };
  }

  /**
   * The only place a statement sequence's final value matters: a program's
   * overall result (what the REPL/test harness reports as "what did running
   * this produce"), which is not a Python language feature at all — Python
   * statements never produce a value the way an expression does; running a
   * script just runs it. This mirrors the CSE machine's own mechanism for
   * the same non-interactive-but-testable need (runCSEMachine's
   * `stash.peek() ?? None` after the whole program finishes): whatever the
   * last bare-expression statement evaluated to, or None if the program's
   * last statement isn't an expression (or there are no statements at all).
   * The *last* statement is genuinely special only here — nowhere else, in
   * particular not in compileStatements below, which every other statement
   * sequence (function/lambda/if/while/for bodies) goes through instead.
   */
  /**
   * A Python script has no "return value" at all — running one is exec(),
   * not calling a function, and this dialect has no REPL/interactive mode
   * that would need one (see compileStatements' doc comment: nothing here
   * is "the value of the program" the way an expression has a value). The
   * entry function's own body is compiled exactly like any other statement
   * sequence, uniformly, with the last statement no different from any
   * other; RETU (push JS `undefined`, not Python's `None` — see its doc
   * comment in opcodes.ts) then ends execution without requiring anything
   * on the stack at all, matching compileStatements' own net-zero
   * guarantee.
   */
  visitFileInputStmt(stmt: StmtNS.FileInput): ExpressionResult {
    const { maxStackSize } = this.compileStatements(stmt.statements);
    this.builder.emitNullary(OpCodes.RETU);
    return { maxStackSize };
  }

  /**
   * Compiles a statement sequence for a function/lambda/if/while/for body —
   * and, via visitFileInputStmt above, the top-level program itself, with
   * no special-casing there either. Always leaves the stack exactly as it
   * found it (net-zero), matching Python's own statement semantics: only an
   * expression used as a statement (SimpleExpr — e.g. a bare `1 + 1` or a
   * call whose result is discarded) produces a value at all, and even that
   * value is immediately popped again since nothing here needs it — every
   * other statement kind (Assign, FunctionDef, If, While, For, Pass,
   * Global, NonLocal, FromImport, Break, Continue, Return, ...) emits no
   * placeholder value of its own to begin with. The *position* of a
   * statement in this list never matters, including the last one: Python
   * statements don't have a value, so there is no "value of a block" to
   * propagate anywhere, top-level or nested. (Return/Break/Continue are
   * also, individually, net-zero here despite transiently pushing something
   * internally — Return's pushed value is consumed by its own RETG, and
   * Break/Continue's own unconditional jump skips past whatever follows in
   * this same statement list, so nothing here needs to pop after them
   * either.)
   */
  compileStatements(statements: StmtNS.Stmt[]): ExpressionResult {
    let maxStackSize = 0;

    for (const stmt of statements) {
      const isExprStmt = stmt instanceof StmtNS.SimpleExpr;
      const result = this.compile(stmt);
      maxStackSize = Math.max(maxStackSize, result.maxStackSize);
      if (isExprStmt) {
        this.builder.emitNullary(OpCodes.POPG);
      }
    }

    return { maxStackSize };
  }
}
