import { numericCompare, pythonMod } from "../cse/utils";
import { PyComplexNumber } from "../../types";
import { executePrimitive } from "./builtins";
import {
  FreeVariableUnboundError,
  IndexError,
  ListIndexTypeError,
  ListMultiplyTypeError,
  NameError,
  PVMLInterpreterError,
  UnboundLocalError,
  UnsupportedOperandTypeError,
  ZeroDivisionError,
} from "./errors";
import OpCodes from "./opcodes";
import {
  getPVMLType,
  isPVMLObject,
  PVMLArray,
  PVMLBoxType,
  PVMLClosure,
  PVMLEnvironment,
  PVMLExtern,
  PVMLIR,
  PVMLIterator,
  PVMLProgram,
  PVMLType,
  pvmlListLiteralArrays,
} from "./types";

/** Whether a value is excluded from §1/§2's `==`/`!=` entirely: bool (avoiding
 * CPython's bool-as-int equality, e.g. `True == 1`, as a directly written
 * §1/§2 comparison) and function values — both closures and primitives
 * (equality without `is` is left undefined until §3/§4 introduces it). See
 * docs/specs/python_typing_middle_12.tex: `==,!= bool,function x any -> error`,
 * `==,!= any x bool,function -> error`. Mirrors the CSE machine's
 * `excludedFromChapter12Equality` in src/engines/cse/operators.ts. */
function isExcludedFromChapter12Equality(value: PVMLBoxType): boolean {
  if (typeof value === "boolean") return true;
  return isPVMLObject(value) && (value.type === "closure" || value.type === "primitive");
}

/** A Python `int` (bigint) or `float` (number) — the two *orderable* numeric
 * runtime types (matching the CSE machine's `isNumeric`), and the only two
 * eligible for `//`/`%` (Python has no complex floor division or modulo:
 * `1j // 2`/`1j % 2` are TypeErrors). See `isArithmeticValue` below for the
 * wider set (also complex) used by `+`/`-`/`*`/`/`/`**`/equality. */
function isNumericValue(value: PVMLBoxType): value is number | bigint {
  return typeof value === "number" || typeof value === "bigint";
}

/** A Python `int`, `float` or `complex` — every type `+`/`-`/`*`/`/`/`**` and
 * `==`/`!=` operate on (see docs/specs/python_typing_3.tex's `**` table and
 * CSE's `isCoercedComplex`). Ordering (`<` etc.) and `//`/`%` use the
 * narrower `isNumericValue` instead — complex numbers support neither in
 * Python. */
function isArithmeticValue(value: PVMLBoxType): value is number | bigint | PyComplexNumber {
  return typeof value === "number" || typeof value === "bigint" || value instanceof PyComplexNumber;
}

/** Promotes a number/bigint/complex value to PyComplexNumber, for mixed
 * arithmetic where at least one operand is already complex. */
function toComplex(value: number | bigint | PyComplexNumber): PyComplexNumber {
  if (value instanceof PyComplexNumber) return value;
  return typeof value === "bigint"
    ? PyComplexNumber.fromBigInt(value)
    : PyComplexNumber.fromNumber(value);
}

/**
 * Complex division, following CPython's scaled algorithm to avoid overflow
 * (see PyComplexNumber.div's doc comment in src/types/value-types.ts, which
 * uses the same algorithm) — reimplemented here rather than calling
 * PyComplexNumber.prototype.div directly because that method reports
 * division-by-zero via the CSE machine's own Context/handleRuntimeError,
 * which PVML has no equivalent of; PVML's own ZeroDivisionError is used here
 * instead, matching every other arithmetic opcode in this file.
 */
function complexDiv(a: PyComplexNumber, b: PyComplexNumber): PyComplexNumber {
  const denominator = b.real * b.real + b.imag * b.imag;
  if (denominator === 0) throw new ZeroDivisionError("complex division by zero");

  const absC = Math.abs(b.real);
  const absD = Math.abs(b.imag);
  let real: number;
  let imag: number;
  if (absD < absC) {
    const ratio = b.imag / b.real;
    const denom = b.real + b.imag * ratio;
    real = (a.real + a.imag * ratio) / denom;
    imag = (a.imag - a.real * ratio) / denom;
  } else {
    const ratio = b.real / b.imag;
    const denom = b.imag + b.real * ratio;
    real = (a.real * ratio + a.imag) / denom;
    imag = (a.imag * ratio - a.real) / denom;
  }
  return new PyComplexNumber(real, imag);
}

const __DEBUG__ =
  typeof (globalThis as Record<string, unknown>).__DEBUG__ !== "undefined" &&
  (globalThis as Record<string, unknown>).__DEBUG__;
const debug: (msg: string) => void = __DEBUG__ ? (msg: string) => console.log(msg) : () => {};

/**
 * TypeScript-based PVML Interpreter
 *
 * This interpreter runs PVML bytecode directly without needing WASM assembly.
 */

/**
 * Call frame for function execution
 */
interface CallFrame {
  closure: PVMLClosure;
  ir: PVMLIR;
  pc: number;
  env: PVMLEnvironment;
  stack: PVMLBoxType[];
  callerFrame: CallFrame | null;
}

/**
 * PVML Interpreter
 */
export class PVMLInterpreter {
  private program: PVMLProgram;
  private currentFrame: CallFrame | null;
  /** Backing store for LDGG/STGG (see opcodes.ts) — a dynamically-growable,
   * name-indexed global environment, entirely separate from the fixed-slot
   * PVMLEnvironment array chain used for locals/nonlocals. Only ever
   * populated when the compiler that produced `program` was run in
   * `useGlobalMap` mode; otherwise LDGG/STGG simply never appear in the
   * bytecode. Optionally supplied externally (see constructor) so a caller
   * can share/persist it across multiple PVMLInterpreter instances — e.g. a
   * REPL evaluating one chunk per instance, where a later chunk needs to see
   * an earlier chunk's globals. */
  private globalEnv: Map<string, PVMLBoxType>;
  private halted: boolean;
  private readonly onOutput: (msg: string) => void;

  // Execution limits for safety
  private maxStackSize: number = 10000;
  private maxCallDepth: number = 1000;
  private callDepth: number = 0;

  private instructionCount: number = 0;
  /** No default cap — PVML runs in a webworker, so runaway code is stopped
   * by terminating the worker from the frontend rather than by an internal
   * step limit (unlike the transpiler/py2js path, which has no worker
   * boundary to rely on). Callers that still want a cap can pass
   * `maxInstructions` explicitly (e.g. tests). */
  private maxInstructionLimit: number = Infinity;

  /** The SICPy chapter (1-4) `program` was compiled for — see Context.variant's
   * doc comment (src/engines/cse/context.ts) for why error construction needs
   * it (a "pair" and a length-2 "list" are the exact same runtime value here).
   * Defaults to 4 (unrestricted), matching the CSE machine's own default. */
  private variant: number = 4;

  /** A dispatched-but-not-yet-run extern (imported-module function) call —
   * `dispatchCall` parks it here instead of running it, because the extern's
   * `fn` is async and `step()` is not; `executeAsync`'s driver loop consumes
   * it (awaits `fn`, pushes the result) immediately after the step that set
   * it. Never survives across steps — it's either consumed by the driver
   * loop or is an error (`invokeValue`'s synchronous nested loop can't await,
   * so an extern call reaching it throws; and plain `execute()` refuses
   * extern calls up front via `allowExtern`). */
  private pendingExtern?: { extern: PVMLExtern; args: PVMLBoxType[] };
  /** True only while `executeAsync`'s driver loop is running — the only
   * context able to await a pendingExtern. See PVMLExtern's doc comment. */
  private allowExtern = false;
  /** See the constructor option of the same name. */
  private legacyArraySemantics: boolean;

  constructor(
    program: PVMLProgram,
    options?: {
      maxStackSize?: number;
      maxCallDepth?: number;
      maxInstructions?: number;
      sendOutput?: (msg: string) => void;
      /** Pre-existing global environment to use (and mutate in place) instead
       * of starting with an empty one — see `globalEnv` above. */
      globalEnv?: Map<string, PVMLBoxType>;
      /** This chunk's own source text, exposed to running Python code as the
       * `__program__` global — mirrors the CSE machine's own
       * `pyDefineVariable(context, "__program__", ...)` (interpreter.ts).
       * Set (overwriting any prior value in a shared `globalEnv`) so each
       * chunk in a REPL sequence sees its own text, not an earlier chunk's —
       * matching CSE's identical "latest chunk wins" behavior, since it
       * re-defines the same global on every runCode() call too. Only
       * meaningful when `program` was compiled in useGlobalMap mode (see
       * PVMLCompiler's `useGlobalMap` field doc) — see getTokenAnnotation's
       * `__program__` special case. */
      programText?: string;
      /** The chapter `program` was compiled for — see `variant` above. */
      variant?: number;
      /**
       * Set only when `program` was compiled with `targetsPynter: true` (see
       * PVMLCompiler's `targetsPynter` field doc) — e.g. via the assembler's
       * disassemble(assemble(...)) round trip (pvml-assembler.test.ts), the
       * only place this TS interpreter ever actually executes that dialect.
       * That compilation mode collapses Python's int/float distinction (both
       * become a plain JS `number` — see visitBigIntLiteralExpr's targetsPynter
       * branch) to match native Pynter's own NaN-boxed numeric model, so the
       * spec-compliant index-type/bounds checks list access/assignment
       * normally enforce (see loadArrayElement/storeArrayElement) can't be
       * applied — there's no way to tell a genuine int index apart from a
       * float one once both are the same JS `number`. Falls back to the
       * pre-#294/#299 behavior instead: an out-of-bounds read yields
       * `undefined`, and an out-of-bounds write grows the array, exactly
       * matching native Pynter's own siarray_get/siarray_put — appropriate
       * here since that's the real semantics this bytecode dialect was
       * compiled to match in the first place.
       */
      legacyArraySemantics?: boolean;
    },
  ) {
    this.program = program;
    this.currentFrame = null;
    this.globalEnv = options?.globalEnv ?? new Map();
    if (options?.programText !== undefined) {
      this.globalEnv.set("__program__", options.programText);
    }
    this.halted = false;
    this.onOutput = options?.sendOutput ?? (() => {});
    this.legacyArraySemantics = options?.legacyArraySemantics ?? false;

    if (options) {
      if (options.maxStackSize) this.maxStackSize = options.maxStackSize;
      if (options.maxCallDepth) this.maxCallDepth = options.maxCallDepth;
      if (options.maxInstructions) this.maxInstructionLimit = options.maxInstructions;
      if (options.variant) this.variant = options.variant;
    }
  }

  /** The current global environment (see `globalEnv` above) — retrieve after
   * `execute()` to thread into a later PVMLInterpreter instance for a REPL's
   * next chunk, so it sees this chunk's global variable/function definitions. */
  getGlobalEnv(): Map<string, PVMLBoxType> {
    return this.globalEnv;
  }

  /** Shared setup for execute()/executeAsync(): builds the entry frame and
   * resets per-run counters. */
  private prepareEntry(): void {
    const entryPointIndex = this.program.entryPoint;
    const entryFunction = this.program.functions[entryPointIndex];

    if (!entryFunction) {
      throw new Error(`Entry point function at index ${entryPointIndex} not found`);
    }

    const entryClosure: PVMLClosure = {
      type: "closure",
      ir: entryFunction,
      functionIndex: entryPointIndex,
      parentEnv: null,
    };

    const entryEnv = new PVMLEnvironment(entryFunction.envSize, null);

    this.currentFrame = {
      closure: entryClosure,
      ir: entryFunction,
      pc: 0,
      env: entryEnv,
      stack: [],
      callerFrame: null,
    };

    this.callDepth = 1;
    this.halted = false;
    this.instructionCount = 0;
  }

  /** Result of a finished run: top of stack, or undefined. Shared by
   * run()/executeAsync(). */
  private finishResult(): PVMLBoxType {
    return this.currentFrame && this.currentFrame.stack.length > 0
      ? this.currentFrame.stack[this.currentFrame.stack.length - 1]
      : undefined;
  }

  /**
   * Execute the program and return the result
   */
  execute(): PVMLBoxType {
    this.prepareEntry();
    return this.run();
  }

  /**
   * Like execute(), but able to run programs that call imported-module
   * functions (PVMLExtern values — see modules.ts): per-instruction dispatch
   * stays the same synchronous step() as run()'s, and only an actual extern
   * call suspends — dispatchCall parks it in `pendingExtern`, this loop
   * awaits the module's async fn, pushes its result (exactly where CALLP
   * would have pushed a primitive's — a tail-call extern works too, since
   * the compiler always emits RETG after CALLT, same as the primitive path),
   * and resumes stepping. Programs without imports pay one field check per
   * instruction over execute(), nothing more.
   */
  async executeAsync(): Promise<PVMLBoxType> {
    this.prepareEntry();
    this.allowExtern = true;
    try {
      while (!this.halted && this.currentFrame) {
        this.step();
        if (this.pendingExtern) {
          const { extern, args } = this.pendingExtern;
          this.pendingExtern = undefined;
          this.push(await extern.fn(args, (f, a) => this.invokeValueAsync(f, a)));
        }
      }
    } finally {
      this.allowExtern = false;
    }
    return this.finishResult();
  }

  /**
   * Main interpreter loop — dispatch from typed arrays
   */
  private run(): PVMLBoxType {
    while (!this.halted && this.currentFrame) {
      this.step();
    }

    return this.finishResult();
  }

  /**
   * Executes exactly one instruction — one iteration of run()'s dispatch
   * loop, extracted so invokeValue() (a primitive calling back into user
   * code, e.g. apply_in_underlying_python) can synchronously drive a nested
   * call to completion by repeatedly stepping until control returns to the
   * calling frame, without needing anything like a resumable step machine
   * (unlike the CSE machine's control/stash architecture, this interpreter's
   * `run()` is already just a flat loop over single-instruction steps driven
   * by `currentFrame`/`callerFrame` links, so this recurses naturally).
   */
  private step(): void {
    if (!this.currentFrame) {
      throw new Error("No current frame");
    }

    // Safety check
    if (this.instructionCount >= this.maxInstructionLimit) {
      throw new Error(`Exceeded maximum instruction limit (${this.maxInstructionLimit})`);
    }
    this.instructionCount++;

    const frame = this.currentFrame;
    const ir = frame.ir;

    if (frame.pc >= ir.count) {
      throw new Error(`PC ${frame.pc} out of bounds for function ${frame.closure.functionIndex}`);
    }

    const pc = frame.pc;
    frame.pc++;

    const op = ir.opcodes[pc];
    const a1 = ir.arg1s[pc];
    const a2 = ir.arg2s[pc];

    if (__DEBUG__)
      debug(
        `PC=${pc} | ${OpCodes[op] || `UNKNOWN(${op})`} ${a1} ${a2} | Stack: [${frame.stack.map(v => JSON.stringify(PVMLInterpreter.toJSValue(v))).join(", ")}]`,
      );

    switch (op) {
      // Load constant instructions
      case OpCodes.LGCI:
      case OpCodes.LDCI:
        this.push(a1);
        break;

      case OpCodes.LGCF32:
      case OpCodes.LDCF32:
      case OpCodes.LGCF64:
      case OpCodes.LDCF64:
        this.push(a1);
        break;

      case OpCodes.LGCB0:
      case OpCodes.LDCB0:
        this.push(false);
        break;

      case OpCodes.LGCB1:
      case OpCodes.LDCB1:
        this.push(true);
        break;

      case OpCodes.LGCU:
        this.push(undefined);
        break;

      case OpCodes.LGCN:
        this.push(null);
        break;

      case OpCodes.LGCS:
        this.push(ir.strings[a1]);
        break;

      // Arbitrary-precision int literal from the bigint constant pool (see
      // PVMLIR's `bigints` field doc) — a1 is a bigint-table index, same
      // encoding pattern as LGCS's string-table index.
      case OpCodes.LGCBI:
        this.push(ir.bigints[a1]);
        break;

      // Complex literal from the complex constant pool (see PVMLIR's
      // `complexes` field doc) — a1 is a complexes-table index, same
      // encoding pattern as LGCS/LGCBI.
      case OpCodes.LGCC:
        this.push(ir.complexes[a1]);
        break;

      // Name-indexed global variable access (see `globalEnv` field doc) —
      // a1 is a string-table index, same encoding as LGCS.
      case OpCodes.LDGG: {
        const globalName = ir.strings[a1];
        // .get() alone can't tell "assigned None" (a real `null` entry) apart
        // from "never assigned" (no entry at all, `.get` also returns
        // `undefined`) — see NameError's doc comment.
        if (!this.globalEnv.has(globalName)) {
          throw new NameError(`NameError: name '${globalName}' is not defined`);
        }
        this.push(this.globalEnv.get(globalName));
        break;
      }

      case OpCodes.STGG:
        this.globalEnv.set(ir.strings[a1], this.pop());
        break;

      // Stack operations
      case OpCodes.POPG:
      case OpCodes.POPB:
      case OpCodes.POPF:
        this.pop();
        break;

      case OpCodes.DUP: {
        const top = this.peek();
        this.push(top);
        break;
      }

      // Arithmetic operations
      case OpCodes.ADDG: {
        const right = this.pop();
        const left = this.pop();
        const leftType = getPVMLType(left);
        const rightType = getPVMLType(right);

        if (isArithmeticValue(left) && isArithmeticValue(right)) {
          this.push(PVMLInterpreter.numericArith("+", left, right));
        } else if (leftType === PVMLType.STRING && rightType === PVMLType.STRING) {
          this.push((left as string) + (right as string));
        } else {
          throw new UnsupportedOperandTypeError(this.variant, "+", leftType, rightType);
        }
        break;
      }
      case OpCodes.ADDF: {
        const right = this.pop() as number;
        const left = this.pop() as number;
        this.push(left + right);
        break;
      }
      case OpCodes.SUBG: {
        const right = this.pop();
        const left = this.pop();
        const leftType = getPVMLType(left);
        const rightType = getPVMLType(right);

        if (isArithmeticValue(left) && isArithmeticValue(right)) {
          this.push(PVMLInterpreter.numericArith("-", left, right));
        } else {
          throw new UnsupportedOperandTypeError(this.variant, "-", leftType, rightType);
        }
        break;
      }
      case OpCodes.SUBF: {
        const right = this.pop() as number;
        const left = this.pop() as number;
        this.push(left - right);
        break;
      }
      case OpCodes.MULG: {
        const right = this.pop();
        const left = this.pop();
        const leftType = getPVMLType(left);
        const rightType = getPVMLType(right);

        // `list * int` is §3/§4 only: at §2, an array value is a cons pair
        // (see visitCallExpr's pair() builtin), which has no `*` row at any
        // chapter (docs/specs/python_typing_middle_34.tex vs _middle_12.tex).
        const isListOperand =
          this.variant >= 3 &&
          ((isPVMLObject(left) && left.type === "array") ||
            (isPVMLObject(right) && right.type === "array"));

        if (isArithmeticValue(left) && isArithmeticValue(right)) {
          this.push(PVMLInterpreter.numericArith("*", left, right));
        } else if (
          isListOperand &&
          isPVMLObject(left) &&
          left.type === "array" &&
          typeof right === "bigint"
        ) {
          this.push(this.repeatArray(left, right));
        } else if (
          isListOperand &&
          isPVMLObject(right) &&
          right.type === "array" &&
          typeof left === "bigint"
        ) {
          this.push(this.repeatArray(right, left));
        } else if (isListOperand) {
          // `list * bool`/`list * float`/`list * list`: bool is deliberately
          // not accepted as a count even though it's numeric-ish (see
          // docs/specs/python_typing_middle_34.tex).
          throw new ListMultiplyTypeError();
        } else {
          throw new UnsupportedOperandTypeError(this.variant, "*", leftType, rightType);
        }
        break;
      }
      case OpCodes.MULF: {
        const right = this.pop() as number;
        const left = this.pop() as number;
        this.push(left * right);
        break;
      }
      case OpCodes.DIVG: {
        const right = this.pop();
        const left = this.pop();
        const leftType = getPVMLType(left);
        const rightType = getPVMLType(right);

        if (isArithmeticValue(left) && isArithmeticValue(right)) {
          this.push(PVMLInterpreter.numericArith("/", left, right));
        } else {
          throw new UnsupportedOperandTypeError(this.variant, "/", leftType, rightType);
        }
        break;
      }
      case OpCodes.DIVF: {
        const right = this.pop() as number;
        const left = this.pop() as number;
        if (right === 0) throw new ZeroDivisionError("division by zero");
        this.push(left / right);
        break;
      }
      case OpCodes.FLOORDIVG: {
        const right = this.pop();
        const left = this.pop();
        const leftType = getPVMLType(left);
        const rightType = getPVMLType(right);

        if (isNumericValue(left) && isNumericValue(right)) {
          this.push(PVMLInterpreter.numericArith("//", left, right));
        } else {
          throw new UnsupportedOperandTypeError(this.variant, "//", leftType, rightType);
        }
        break;
      }
      case OpCodes.FLOORDIVF: {
        const right = this.pop() as number;
        const left = this.pop() as number;
        if (right === 0) throw new ZeroDivisionError("division by zero");
        this.push(Math.floor(left / right));
        break;
      }
      case OpCodes.MODG: {
        const right = this.pop();
        const left = this.pop();
        const leftType = getPVMLType(left);
        const rightType = getPVMLType(right);
        if (isNumericValue(left) && isNumericValue(right)) {
          this.push(PVMLInterpreter.numericArith("%", left, right));
        } else {
          throw new UnsupportedOperandTypeError(this.variant, "%", leftType, rightType);
        }
        break;
      }
      case OpCodes.MODF: {
        const right = this.pop() as number;
        const left = this.pop() as number;
        if (right === 0) throw new ZeroDivisionError("integer modulo by zero");
        this.push(pythonMod(left, right));
        break;
      }
      case OpCodes.POWG: {
        const right = this.pop();
        const left = this.pop();
        const leftType = getPVMLType(left);
        const rightType = getPVMLType(right);

        if (isArithmeticValue(left) && isArithmeticValue(right)) {
          this.push(PVMLInterpreter.powArith(left, right));
        } else {
          throw new UnsupportedOperandTypeError(this.variant, "**", leftType, rightType);
        }
        break;
      }
      // Unary operations
      case OpCodes.NEGG: {
        const operand = this.pop();
        const operandType = getPVMLType(operand);
        if (typeof operand === "number") {
          this.push(-operand);
        } else if (typeof operand === "bigint") {
          this.push(-operand);
        } else if (operand instanceof PyComplexNumber) {
          this.push(new PyComplexNumber(-operand.real, -operand.imag));
        } else {
          throw new UnsupportedOperandTypeError(this.variant, "-", operandType);
        }
        break;
      }
      case OpCodes.NEGF: {
        const operand = this.pop() as number;
        this.push(-operand);
        break;
      }
      case OpCodes.NOTG: {
        const operand = this.pop();
        if (typeof operand !== "boolean") {
          throw new UnsupportedOperandTypeError(this.variant, "not", getPVMLType(operand));
        }
        this.push(!operand);
        break;
      }
      case OpCodes.NOTB:
        this.negateBoolean();
        break;

      // Comparison operations
      case OpCodes.LTG:
        this.genericOrderedComparison("<");
        break;
      case OpCodes.LTF:
        this.lessThanNumbers();
        break;

      case OpCodes.GTG:
        this.genericOrderedComparison(">");
        break;
      case OpCodes.GTF:
        this.greaterThanNumbers();
        break;

      case OpCodes.LEG:
        this.genericOrderedComparison("<=");
        break;
      case OpCodes.LEF:
        this.lessThanOrEqualNumbers();
        break;

      case OpCodes.GEG:
        this.genericOrderedComparison(">=");
        break;
      case OpCodes.GEF:
        this.greaterThanOrEqualNumbers();
        break;

      case OpCodes.EQG:
      case OpCodes.EQF:
      case OpCodes.EQB:
        this.strictEqual();
        break;

      case OpCodes.NEQG:
      case OpCodes.NEQF:
      case OpCodes.NEQB:
        this.strictNotEqual();
        break;

      // §1/§2-restricted comparisons (see opcodes.ts): bool/function operands
      // are rejected outright, rather than the §3/§4 opcodes' bool-as-int
      // coercion (LTG/GTG/LEG/GEG/EQG/NEQG above).
      case OpCodes.LTG12:
        this.genericOrderedComparison12("<");
        break;
      case OpCodes.GTG12:
        this.genericOrderedComparison12(">");
        break;
      case OpCodes.LEG12:
        this.genericOrderedComparison12("<=");
        break;
      case OpCodes.GEG12:
        this.genericOrderedComparison12(">=");
        break;
      case OpCodes.EQG12:
        this.strictEqual12();
        break;
      case OpCodes.NEQG12:
        this.strictNotEqual12();
        break;

      case OpCodes.EQP:
        this.identityEqual();
        break;
      case OpCodes.NEQP:
        this.identityNotEqual();
        break;

      // Variable operations
      case OpCodes.LDLG:
        this.loadLocal(a1);
        // A list literal's compiled shape ends with exactly this instruction pushing its
        // completed array (see PVMLCompiler's visitListExpr) - tag it here so pvmlToModule can
        // tell an exactly-2-element list literal apart from a dotted pair (see
        // pvmlListLiteralArrays' doc comment in types.ts).
        if (ir.listLiteralOffsets.has(pc)) {
          const loaded = this.peek();
          if (isPVMLObject(loaded) && loaded.type === "array") {
            pvmlListLiteralArrays.add(loaded);
          }
        }
        break;
      case OpCodes.LDLF:
      case OpCodes.LDLB:
        this.loadLocal(a1);
        break;

      case OpCodes.STLG:
      case OpCodes.STLF:
      case OpCodes.STLB:
        this.storeLocal(a1);
        break;

      case OpCodes.LDPG:
      case OpCodes.LDPF:
      case OpCodes.LDPB:
        this.loadParent(a1, a2);
        break;

      case OpCodes.STPG:
      case OpCodes.STPF:
      case OpCodes.STPB:
        this.storeParent(a1, a2);
        break;

      // Control flow
      case OpCodes.BR:
        this.branch(a1);
        break;

      case OpCodes.BRT:
        this.branchIfTrue(a1);
        break;

      case OpCodes.BRF:
        this.branchIfFalse(a1);
        break;

      // Function operations
      case OpCodes.NEWC:
        this.createClosure(a1);
        break;

      case OpCodes.NEWCP:
        this.push({ type: "primitive", primitiveIndex: a1 });
        break;

      case OpCodes.CALL:
        this.call(a1, false);
        break;

      case OpCodes.CALLT:
        this.call(a1, true);
        break;

      case OpCodes.CALLP:
      case OpCodes.CALLTP:
        this.callPrimitive(a1, a2);
        break;

      case OpCodes.CALLA:
        this.callWithArray(false);
        break;

      case OpCodes.CALLTA:
        this.callWithArray(true);
        break;

      case OpCodes.RETG:
      case OpCodes.RETF:
      case OpCodes.RETB:
        this.return();
        break;

      case OpCodes.RETU:
        this.push(undefined);
        this.return();
        break;

      case OpCodes.RETN:
        this.push(null);
        this.return();
        break;

      // Array operations
      case OpCodes.NEWA:
        this.createArray(a1);
        break;

      case OpCodes.LDAG:
      case OpCodes.LDAB:
      case OpCodes.LDAF:
        this.loadArrayElement();
        break;

      case OpCodes.STAG:
      case OpCodes.STAB:
      case OpCodes.STAF:
        this.storeArrayElement();
        break;

      // Iterator opcodes
      case OpCodes.NEWITER: {
        const iterable = this.pop();
        if (isPVMLObject(iterable)) {
          if (iterable.type === "array") {
            const iter: PVMLIterator = {
              type: "iterator",
              kind: "list",
              array: iterable,
              index: 0,
            };
            this.push(iter);
          } else if (iterable.type === "iterator") {
            this.push(iterable); // identity
          } else {
            throw new Error("NEWITER: value is not iterable");
          }
        } else {
          throw new Error("NEWITER: value is not iterable");
        }
        break;
      }

      case OpCodes.FOR_ITER: {
        const iter = this.peek() as PVMLIterator;
        let done = false;
        let nextValue: PVMLBoxType = undefined;

        if (iter.kind === "range") {
          const going = iter.step! > 0 ? iter.current! < iter.stop! : iter.current! > iter.stop!;
          if (going) {
            nextValue = iter.current!;
            iter.current! += iter.step!;
          } else {
            done = true;
          }
        } else {
          // "list"
          if (iter.index! < iter.array!.elements.length) {
            nextValue = iter.array!.elements[iter.index!++];
          } else {
            done = true;
          }
        }

        if (done) {
          this.pop(); // remove iterator from stack
          this.branch(a1);
        } else {
          this.push(nextValue);
        }
        break;
      }

      // Environment operations
      case OpCodes.NEWENV:
        // Usually handled by CALL, but can be no-op here
        break;

      case OpCodes.POPENV:
        // Usually handled by RETG, but can be no-op here
        break;

      case OpCodes.NOP:
        // Do nothing
        break;

      default:
        throw new Error(`Unimplemented opcode: ${op} (${OpCodes[op] || "UNKNOWN"})`);
    }
  }

  // ========================================================================
  // Stack Operations
  // ========================================================================

  private push(value: PVMLBoxType): void {
    if (!this.currentFrame) {
      throw new Error("No current frame for push");
    }
    if (this.currentFrame.stack.length >= this.maxStackSize) {
      throw new Error(`Stack overflow (max: ${this.maxStackSize})`);
    }
    this.currentFrame.stack.push(value);
  }

  private pop(): PVMLBoxType {
    if (!this.currentFrame) {
      throw new Error("No current frame for pop");
    }
    if (this.currentFrame.stack.length === 0) {
      if (__DEBUG__)
        debug(`STACK UNDERFLOW! Current frame: ${this.currentFrame.closure.functionIndex}`);
      throw new Error("Stack underflow");
    }
    const value = this.currentFrame.stack.pop()!;
    if (__DEBUG__) debug(`  Popped: ${JSON.stringify(PVMLInterpreter.toJSValue(value))}`);
    return value;
  }

  private peek(offset: number = 0): PVMLBoxType {
    if (!this.currentFrame) {
      throw new Error("No current frame for peek");
    }
    const index = this.currentFrame.stack.length - 1 - offset;
    if (index < 0) {
      throw new Error("Stack underflow on peek");
    }
    return this.currentFrame.stack[index];
  }

  // ========================================================================
  // Arithmetic/Logical Operations
  // ========================================================================

  private negateBoolean(): void {
    const operand = this.pop() as boolean;
    this.push(!operand);
  }

  private lessThanNumbers(): void {
    const right = this.pop() as number;
    const left = this.pop() as number;
    this.push(left < right);
  }

  private greaterThanNumbers(): void {
    const right = this.pop() as number;
    const left = this.pop() as number;
    this.push(left > right);
  }

  private lessThanOrEqualNumbers(): void {
    const right = this.pop() as number;
    const left = this.pop() as number;
    this.push(left <= right);
  }

  private greaterThanOrEqualNumbers(): void {
    const right = this.pop() as number;
    const left = this.pop() as number;
    this.push(left >= right);
  }

  /** Booleans participate in `==`/`!=`/ordering as the ints they are at §3/§4
   * (True == 1 is true), as in CPython where bool is an int subtype. Every
   * other value passes through unchanged. Used only by the §3/§4 comparison
   * opcodes (EQG/NEQG/LTG/GTG/LEG/GEG) — deliberately not by their §1/§2
   * counterparts (EQG12/etc.), which reject bool operands instead. Coerces to
   * bigint (matching every other Python int's runtime representation here),
   * not `number` — see PVMLType.BIGINT's doc comment. */
  private static asNumberIfBool(value: PVMLBoxType): PVMLBoxType {
    return typeof value === "boolean" ? (value ? 1n : 0n) : value;
  }

  /**
   * `==`/`!=` between two numeric (int/float/complex) values: same-type
   * values compare exactly (bigint vs bigint, or number vs number); a mixed
   * bigint/float pair goes through `numericCompare` (see ../cse/utils,
   * shared with the CSE machine) for magnitude-correct cross-type
   * comparison. If either side is complex, both are coerced to complex and
   * compared via PyComplexNumber.equals (int/float coerce to a
   * zero-imaginary-part complex, matching CPython: `1 == (1+0j)` is True).
   * As in CPython, NaN is unordered and unequal to everything, including
   * itself.
   */
  private static numericEquals(
    left: number | bigint | PyComplexNumber,
    right: number | bigint | PyComplexNumber,
  ): boolean {
    if (left instanceof PyComplexNumber || right instanceof PyComplexNumber) {
      return toComplex(left).equals(toComplex(right));
    }
    if (typeof left === "number" && Number.isNaN(left)) return false;
    if (typeof right === "number" && Number.isNaN(right)) return false;
    if (typeof left === "bigint" && typeof right === "bigint") return left === right;
    if (typeof left === "number" && typeof right === "number") return left === right;
    return numericCompare(left, right) === 0;
  }

  /** `<`/`>`/`<=`/`>=` between two numeric (int/float) values — see
   * `numericEquals` above for the same same-type-exact / mixed-type-via-
   * `numericCompare` split, and the same NaN handling (every ordering
   * comparison with a NaN operand is False). */
  private static numericOrder(
    op: "<" | ">" | "<=" | ">=",
    left: number | bigint,
    right: number | bigint,
  ): boolean {
    if (typeof left === "number" && Number.isNaN(left)) return false;
    if (typeof right === "number" && Number.isNaN(right)) return false;
    const cmp = numericCompare(left, right);
    switch (op) {
      case "<":
        return cmp < 0;
      case ">":
        return cmp > 0;
      case "<=":
        return cmp <= 0;
      case ">=":
        return cmp >= 0;
    }
  }

  /**
   * `+`/`-`/`*`/`/`/`//`/`%` between two numeric (int/float) values, mirroring
   * the CSE machine's exact promotion rules (src/engines/cse/operators.ts):
   * if either operand is a float, both are coerced to float (with potential
   * precision loss for huge bigints — this is Python's own float-coercion
   * behavior, not a shortcut); if both are int (bigint), the result stays a
   * bigint at full precision, except `/` which always produces a float even
   * for int/int (Python 3's true division, PEP 238).
   */
  private static numericArith(
    op: "+" | "-" | "*" | "/" | "//" | "%",
    left: number | bigint | PyComplexNumber,
    right: number | bigint | PyComplexNumber,
  ): number | bigint | PyComplexNumber {
    if (left instanceof PyComplexNumber || right instanceof PyComplexNumber) {
      // Callers only ever reach here with a complex operand for +/-/*//
      // (ADDG/SUBG/MULG/DIVG) — FLOORDIVG/MODG gate on the narrower
      // isNumericValue (no complex) before calling this at all, since Python
      // has no complex floor division or modulo.
      const l = toComplex(left);
      const r = toComplex(right);
      switch (op) {
        case "+":
          return l.add(r);
        case "-":
          return l.sub(r);
        case "*":
          return l.mul(r);
        case "/":
          return complexDiv(l, r);
        default:
          throw new PVMLInterpreterError(
            `TypeError: unsupported operand type(s) for ${op}: 'complex'`,
          );
      }
    }
    if (typeof left === "number" || typeof right === "number") {
      const l = Number(left);
      const r = Number(right);
      switch (op) {
        case "+":
          return l + r;
        case "-":
          return l - r;
        case "*":
          return l * r;
        case "/":
          if (r === 0) throw new ZeroDivisionError("division by zero");
          return l / r;
        case "//":
          if (r === 0) throw new ZeroDivisionError("division by zero");
          return Math.floor(l / r);
        case "%":
          if (r === 0) throw new ZeroDivisionError("integer modulo by zero");
          return pythonMod(l, r);
      }
    }
    const l = left;
    const r = right;
    switch (op) {
      case "+":
        return l + r;
      case "-":
        return l - r;
      case "*":
        return l * r;
      case "/":
        if (r === 0n) throw new ZeroDivisionError("division by zero");
        return Number(l) / Number(r);
      case "//":
        if (r === 0n) throw new ZeroDivisionError("division by zero");
        return (l - pythonMod(l, r)) / r;
      case "%":
        if (r === 0n) throw new ZeroDivisionError("integer modulo by zero");
        return pythonMod(l, r);
    }
  }

  /**
   * `**`, matching docs/specs/python_typing_3.tex's exponentiation table:
   * int**int with a non-negative exponent stays int (arbitrary precision);
   * a negative int exponent (or any float/complex operand) promotes to
   * float/complex. `0 ** negative` is a ZeroDivisionError in Python, checked
   * before JS's own `**` would otherwise happily return Infinity.
   */
  private static powArith(
    left: number | bigint | PyComplexNumber,
    right: number | bigint | PyComplexNumber,
  ): number | bigint | PyComplexNumber {
    if (left instanceof PyComplexNumber || right instanceof PyComplexNumber) {
      return toComplex(left).pow(toComplex(right));
    }
    if (typeof left === "bigint" && typeof right === "bigint") {
      if (left === 0n && right < 0n) {
        throw new ZeroDivisionError("0.0 cannot be raised to a negative power");
      }
      if (right < 0n) return Number(left) ** Number(right);
      return left ** right;
    }
    const l = Number(left);
    const r = Number(right);
    if (l === 0 && r < 0) throw new ZeroDivisionError("0.0 cannot be raised to a negative power");
    return l ** r;
  }

  /** Whether `value` is a NaN float, or a complex value with a NaN real or
   * imaginary component — mirrors the CSE machine's own isNaNValue
   * (cse/operators.ts). Used to guard the top-level identity shortcut in
   * `valuesEqual` below (see its doc comment) — never called on array
   * elements, where `structuralElementsEqual`'s own `identical()`-based
   * shortcut (which *does* treat matching-payload NaN as identical, since an
   * unboxed number here has no other notion of identity — see `identical`'s
   * own doc comment) is what CSE's container-comparison rule actually needs.
   */
  private static isNaNValue(value: PVMLBoxType): boolean {
    if (typeof value === "number") return Number.isNaN(value);
    if (value instanceof PyComplexNumber)
      return Number.isNaN(value.real) || Number.isNaN(value.imag);
    return false;
  }

  /**
   * Structural equality between two *array elements* reached while recursing
   * through `valuesEqual` (never called on the top-level operands — see
   * `valuesEqual`'s own doc comment for why the shortcut here would be wrong
   * there). Mirrors CSE's structuralEquals (cse/operators.ts): checks `x is
   * y` (via `identical`) before `x == y`, so a list containing NaN still
   * equals itself — CPython's own container-comparison rule (list/tuple/dict
   * equality short-circuits identical elements before ever calling their
   * `__eq__`), which is what makes `[math_nan] == [math_nan]` true even
   * though bare `math_nan == math_nan` (guarded at the top level, above)
   * isn't.
   */
  private static structuralElementsEqual(
    left: PVMLBoxType,
    right: PVMLBoxType,
    restrictChapter12: boolean,
    op: "==" | "!=",
    variant: number,
  ): boolean {
    if (
      restrictChapter12 &&
      (isExcludedFromChapter12Equality(left) || isExcludedFromChapter12Equality(right))
    ) {
      throw new UnsupportedOperandTypeError(variant, op, getPVMLType(left), getPVMLType(right));
    }
    if (PVMLInterpreter.identical(left, right)) return true;
    if (isArithmeticValue(left) && isArithmeticValue(right)) {
      return PVMLInterpreter.numericEquals(left, right);
    }
    if (
      isPVMLObject(left) &&
      left.type === "array" &&
      isPVMLObject(right) &&
      right.type === "array"
    ) {
      return (
        left.elements.length === right.elements.length &&
        left.elements.every((el, i) =>
          PVMLInterpreter.structuralElementsEqual(
            el,
            right.elements[i],
            restrictChapter12,
            op,
            variant,
          ),
        )
      );
    }
    return false;
  }

  /**
   * Structural equality between any two PVML values, matching Python/CPython
   * semantics (mirrors the CSE machine's own structuralEquals/
   * handleExpandedEquality split in cse/operators.ts, which is the
   * authoritative reference this is checked against — see
   * operator-conformance-pvml.test.ts): numeric values compare across
   * int/float/complex via numericEquals; lists compare element-wise,
   * recursively (via structuralElementsEqual, which — unlike this top-level
   * function — *does* apply CPython's identity-before-equality container
   * shortcut); every other value compares by reference (`===`), which
   * already gives correct by-value semantics for JS primitives boxed here
   * (strings, None/null) and correct reference semantics for the rest
   * (closures, primitives, iterators) — CSE has no separate value-equality
   * notion for those either, see structuralEquals' own "by reference"
   * fallback.
   *
   * A top-level NaN operand (a NaN float, or a complex value with a NaN
   * component) is unequal to everything, even the very same object/binding
   * (CPython: `nan == nan` is False even for one shared `nan`) — checked
   * *before* the identity shortcut below, mirroring CSE's
   * handleExpandedEquality, which applies this same guard before ever
   * calling structuralEquals, specifically so the identity shortcut still
   * fires for a NaN *element* nested inside a list (structuralElementsEqual
   * above), just not for the top-level comparison itself.
   *
   * `restrictChapter12`, when set, re-applies `isExcludedFromChapter12Equality`
   * at *every* level of recursion, not just the top-level operands — so a
   * bool/function nested inside a list is still an error at §1/§2 (e.g.
   * `pair(1, 2) == pair(True, 3)`), not a silently-wrong bool. `op` is only
   * used to build that error's message.
   */
  private static valuesEqual(
    left: PVMLBoxType,
    right: PVMLBoxType,
    restrictChapter12: boolean,
    op: "==" | "!=" = "==",
    variant: number = 4,
  ): boolean {
    if (
      restrictChapter12 &&
      (isExcludedFromChapter12Equality(left) || isExcludedFromChapter12Equality(right))
    ) {
      throw new UnsupportedOperandTypeError(variant, op, getPVMLType(left), getPVMLType(right));
    }
    if (PVMLInterpreter.isNaNValue(left) || PVMLInterpreter.isNaNValue(right)) return false;
    if (left === right) return true;
    if (isArithmeticValue(left) && isArithmeticValue(right)) {
      return PVMLInterpreter.numericEquals(left, right);
    }
    if (
      isPVMLObject(left) &&
      left.type === "array" &&
      isPVMLObject(right) &&
      right.type === "array"
    ) {
      return (
        left.elements.length === right.elements.length &&
        left.elements.every((el, i) =>
          PVMLInterpreter.structuralElementsEqual(
            el,
            right.elements[i],
            restrictChapter12,
            op,
            variant,
          ),
        )
      );
    }
    return false;
  }

  private strictEqual(): void {
    const right = PVMLInterpreter.asNumberIfBool(this.pop());
    const left = PVMLInterpreter.asNumberIfBool(this.pop());
    this.push(PVMLInterpreter.valuesEqual(left, right, false, "==", this.variant));
  }

  private strictNotEqual(): void {
    const right = PVMLInterpreter.asNumberIfBool(this.pop());
    const left = PVMLInterpreter.asNumberIfBool(this.pop());
    this.push(!PVMLInterpreter.valuesEqual(left, right, false, "!=", this.variant));
  }

  /** §1/§2's `==`/`!=` (see docs/specs/python_typing_middle_12.tex): bool and
   * function values (closures/primitives) are excluded entirely, even against
   * each other (`True == True` is an error, not `true`) — unlike §3/§4, there
   * is no bool-as-int coercion here at all. */
  private strictEqual12(): void {
    const right = this.pop();
    const left = this.pop();
    this.push(PVMLInterpreter.valuesEqual(left, right, true, "==", this.variant));
  }

  private strictNotEqual12(): void {
    const right = this.pop();
    const left = this.pop();
    this.push(!PVMLInterpreter.valuesEqual(left, right, true, "!=", this.variant));
  }

  /**
   * `is`: Python pointer/identity equality, as distinct from `==`'s structural
   * equality (see docs/specs/python_typing_tail_34.tex; mirrors the CSE
   * machine's own pyIdentical in cse/operators.ts, checked against directly
   * by operator-conformance-pvml.test.ts). Arrays and closures are boxed JS
   * objects here, so `===` already compares them by reference — two
   * separately-built lists with equal elements are `is`-unequal even though
   * `==`-equal. Scalars (number/string/boolean/None) have no separate
   * identity in this representation, so `===` on them doubles as identity;
   * this still satisfies the spec's only hard guarantee (`None`/`True`/`False`
   * are each a single instance system-wide), since JS gives that for free.
   * Complex numbers are a boxed JS object (PyComplexNumber) like arrays, but
   * — unlike arrays — are conceptually just another immutable scalar with no
   * separate identity (matching pyIdentical's own explicit complex case), so
   * `===` alone is wrong for them: two separately-constructed but
   * value-equal complex numbers must still be `is`-identical, which needs an
   * explicit `.equals()` check, not JS reference comparison.
   * Deliberately no bool-as-int coercion (unlike EQG/NEQG above) — `1 is True`
   * must be false, since `is` never treats values of different types as equal.
   *
   * NaN floats need one more special case on top of the `===` shortcut
   * above: `math_nan` (the *only* source of a NaN float in this dialect —
   * there's no general string-parsing `float()` here to build an
   * independent one) is a single shared JS `number` primitive value, and
   * every reference to it — or to a variable bound to it — pushes that same
   * `NaN` primitive onto the stack. But unlike CSE's boxed Value objects,
   * where two reads of the same binding are the same JS *object* (so `===`
   * already succeeds), a JS `number` primitive has no identity of its own:
   * `NaN === NaN` is false even for what is conceptually "the same" NaN.
   * Without this, `math_nan is math_nan`/`x = math_nan; x is x` would
   * wrongly report false. Since this dialect has no way to construct a NaN
   * float that should be considered a *different* one, treating any two
   * NaN numbers as identical is exactly right here, not just a workaround.
   */
  private static identical(left: PVMLBoxType, right: PVMLBoxType): boolean {
    if (left === right) return true;
    if (typeof left === "number" && typeof right === "number") {
      return Number.isNaN(left) && Number.isNaN(right);
    }
    if (left instanceof PyComplexNumber && right instanceof PyComplexNumber) {
      return left.equals(right);
    }
    return false;
  }

  private identityEqual(): void {
    const right = this.pop();
    const left = this.pop();
    this.push(PVMLInterpreter.identical(left, right));
  }

  private identityNotEqual(): void {
    const right = this.pop();
    const left = this.pop();
    this.push(!PVMLInterpreter.identical(left, right));
  }

  private genericOrderedComparison(op: "<" | ">" | "<=" | ">="): void {
    const right = PVMLInterpreter.asNumberIfBool(this.pop());
    const left = PVMLInterpreter.asNumberIfBool(this.pop());
    const leftType = getPVMLType(left);
    const rightType = getPVMLType(right);

    if (isNumericValue(left) && isNumericValue(right)) {
      this.push(PVMLInterpreter.numericOrder(op, left, right));
      return;
    }
    if (leftType === PVMLType.STRING && rightType === PVMLType.STRING) {
      const l = left as string;
      const r = right as string;
      if (op === "<") this.push(l < r);
      else if (op === ">") this.push(l > r);
      else if (op === "<=") this.push(l <= r);
      else this.push(l >= r);
      return;
    }
    throw new UnsupportedOperandTypeError(this.variant, op, leftType, rightType);
  }

  /** §1/§2's ordering comparisons (see docs/specs/python_typing_middle_12.tex):
   * int/float/string operands only — no bool-as-int coercion (unlike §3/§4's
   * genericOrderedComparison above), so a bool operand is simply rejected. */
  private genericOrderedComparison12(op: "<" | ">" | "<=" | ">="): void {
    const right = this.pop();
    const left = this.pop();
    const leftType = getPVMLType(left);
    const rightType = getPVMLType(right);

    if (isNumericValue(left) && isNumericValue(right)) {
      this.push(PVMLInterpreter.numericOrder(op, left, right));
      return;
    }
    if (leftType === PVMLType.STRING && rightType === PVMLType.STRING) {
      const l = left as string;
      const r = right as string;
      if (op === "<") this.push(l < r);
      else if (op === ">") this.push(l > r);
      else if (op === "<=") this.push(l <= r);
      else this.push(l >= r);
      return;
    }
    throw new UnsupportedOperandTypeError(this.variant, op, leftType, rightType);
  }

  // ========================================================================
  // Variable Operations
  // ========================================================================

  private loadLocal(slot: number): void {
    if (!this.currentFrame) {
      throw new Error("No current frame");
    }
    const value = this.currentFrame.env.get(slot);
    // `undefined` is PVMLEnvironment's initial fill value, never a real
    // stored value (None is the distinct `null` — see UnboundLocalError's
    // doc comment) — so this slot has never been assigned yet.
    if (value === undefined) {
      throw new UnboundLocalError("UnboundLocalError: local variable referenced before assignment");
    }
    this.push(value);
  }

  private storeLocal(slot: number): void {
    if (!this.currentFrame) {
      throw new Error("No current frame");
    }
    const value = this.pop();
    if (__DEBUG__)
      debug(`[STLG] Storing to slot ${slot}: ${JSON.stringify(PVMLInterpreter.toJSValue(value))}`);
    this.currentFrame.env.set(slot, value);
  }

  private loadParent(slot: number, level: number): void {
    if (!this.currentFrame) {
      throw new Error("No current frame");
    }

    if (__DEBUG__) debug(`[LDPG] Loading from parent env: slot=${slot}, level=${level}`);

    const parentEnv = this.currentFrame.env.getParent(level);
    if (__DEBUG__) debug(`[LDPG] Parent env has ${parentEnv.getSize()} slots`);
    const value = parentEnv.get(slot);
    if (__DEBUG__)
      debug(`[LDPG] Loaded value: ${JSON.stringify(PVMLInterpreter.toJSValue(value))}`);
    // See loadLocal's identical `undefined` check — the enclosing function's
    // own slot hasn't been assigned yet.
    if (value === undefined) {
      throw new FreeVariableUnboundError(
        "FreeVariableUnboundError: free variable referenced before assignment in enclosing scope",
      );
    }
    this.push(value);
  }

  private storeParent(slot: number, level: number): void {
    if (!this.currentFrame) {
      throw new Error("No current frame");
    }
    const value = this.pop();
    const parentEnv = this.currentFrame.env.getParent(level);
    parentEnv.set(slot, value);
  }

  // ========================================================================
  // Control Flow
  // ========================================================================

  private branch(offset: number): void {
    if (!this.currentFrame) {
      throw new Error("No current frame");
    }
    this.currentFrame.pc += offset - 1;
  }

  private branchIfTrue(offset: number): void {
    const condition = this.pop();
    if (typeof condition !== "boolean") {
      throw new UnsupportedOperandTypeError(this.variant, "branch", getPVMLType(condition));
    }
    if (condition) {
      this.branch(offset);
    }
  }

  private branchIfFalse(offset: number): void {
    const condition = this.pop();
    if (typeof condition !== "boolean") {
      throw new UnsupportedOperandTypeError(this.variant, "branch", getPVMLType(condition));
    }
    if (!condition) {
      this.branch(offset);
    }
  }

  // ========================================================================
  // Function Operations
  // ========================================================================

  private createClosure(functionIndex: number): void {
    if (!this.currentFrame) {
      throw new Error("No current frame");
    }

    // Resolve against the *currently executing function's own* sibling
    // table (PVMLIR's `siblings`), not `this.program` (this interpreter
    // instance's own, possibly unrelated, program — see PVMLIR's `siblings`
    // doc comment, and invokeValue's identical reasoning for dispatching
    // calls through `closure.ir` directly). A self- or sibling-reference
    // inside a prelude function compiled and run in an earlier
    // PVMLInterpreter instance must still resolve against *that*
    // compilation's function table when the resulting closure is later
    // invoked from a different instance (e.g. a later REPL chunk).
    const ir = this.currentFrame.ir.siblings[functionIndex];
    if (!ir) {
      throw new Error(`Function at index ${functionIndex} not found`);
    }

    const closure: PVMLClosure = {
      type: "closure",
      ir,
      functionIndex,
      parentEnv: this.currentFrame.env,
    };

    this.push(closure);
  }

  private call(numArgs: number, isTailCall: boolean): void {
    if (!this.currentFrame) {
      throw new Error("No current frame");
    }

    if (__DEBUG__)
      debug(
        `[CALL] numArgs=${numArgs}, stackSize=${this.currentFrame.stack}, isTail=${isTailCall}`,
      );

    // Stack layout: [... func arg1 arg2 ... argN] with argN on top
    const args = new Array<PVMLBoxType>(numArgs);
    for (let i = numArgs - 1; i >= 0; i--) {
      if (this.currentFrame?.stack.length === 0) {
        throw new Error(`Stack underflow while popping argument ${i}/${numArgs}. Stack was empty.`);
      }
      args[i] = this.pop();
    }

    if (__DEBUG__)
      debug(`[CALL] Popped ${numArgs} args, stack now has ${this.currentFrame.stack.length} items`);

    if (this.currentFrame?.stack.length === 0) {
      throw new Error(
        `Stack underflow while popping function. ` +
          `After popping ${numArgs} arguments, stack is empty. ` +
          `This means the function was never pushed onto the stack. ` +
          `Check that LDLG/LDPG is being emitted before arguments.`,
      );
    }

    const func = this.pop();
    if (__DEBUG__)
      debug(`[CALL] Popped function: ${JSON.stringify(PVMLInterpreter.toJSValue(func))}`);

    this.dispatchCall(func, args, isTailCall);
  }

  /** CALLA/CALLTA: like `call()`, but the argument list comes from a runtime
   * `PVMLArray` (built by the compiler via `_concat_arrays` — see
   * opcodes.ts's CALLA doc comment) instead of a compile-time-fixed count of
   * stack slots, for call-site argument spreading (`f(*xs)`). Stack layout:
   * `[... func argsArray]` with argsArray on top. */
  private callWithArray(isTailCall: boolean): void {
    const argsArray = this.pop();
    if (!isPVMLObject(argsArray) || argsArray.type !== "array") {
      throw new Error(
        `CALLA/CALLTA expected an array of arguments, got: ${JSON.stringify(PVMLInterpreter.toJSValue(argsArray))}`,
      );
    }
    const func = this.pop();
    this.dispatchCall(func, argsArray.elements, isTailCall);
  }

  /**
   * Given a callee value and its already-collected arguments, dispatch to
   * either `executePrimitive` (a `PVMLPrimitive` value) or a new/replaced
   * call frame (a `PVMLClosure` value). Shared by `call()` (args popped from
   * the stack, one per `CALL`/`CALLT` operand), `callWithArray()` (args from
   * a popped `PVMLArray` — see `CALLA`/`CALLTA`, for call-site spread
   * arguments), and `invokeValue()` (a primitive calling back into user
   * code, e.g. `apply_in_underlying_python`) — none of these differ in how
   * the callee is actually invoked once `args` is in hand, only in how
   * `args` got collected.
   */
  private dispatchCall(func: PVMLBoxType, args: PVMLBoxType[], isTailCall: boolean): void {
    // A tail call mutates the existing frame in place, so it genuinely needs one to already
    // exist. A non-tail call doesn't - the closure branch below always builds a brand new frame
    // (callerFrame: this.currentFrame, which may itself be null), and the extern branch never
    // touches currentFrame at all. This lets invokeValueAsync re-enter with no current frame at
    // all (a scheduled callback firing after executeAsync() has already returned and unwound) -
    // see its own doc comment. The primitive branch still implicitly requires a frame (via
    // push()), which throws its own clear error if that's ever not the case.
    if (!this.currentFrame && isTailCall) {
      throw new Error("No current frame");
    }

    if (!isTailCall && this.callDepth >= this.maxCallDepth) {
      throw new Error(`Maximum call depth exceeded (${this.maxCallDepth})`);
    }

    const numArgs = args.length;

    // An imported-module function (see PVMLExtern's doc comment): its
    // implementation is async host code, which this synchronous method can't
    // run — park the call for executeAsync's driver loop to await. The
    // result lands on the stack exactly where the primitive case below would
    // have pushed it (tail calls included — the compiler's trailing RETG
    // returns it, same as for a tail-called primitive).
    if (isPVMLObject(func) && func.type === "extern") {
      if (!this.allowExtern) {
        throw new PVMLInterpreterError(
          `RuntimeError: imported module function '${func.name}' can only be called under ` +
            `executeAsync() (synchronous execute() cannot await module code)`,
        );
      }
      if (this.pendingExtern) {
        // Can only happen from invokeValue's nested synchronous loop — the
        // driver loop otherwise consumes pendingExtern immediately after the
        // step that set it. See invokeValue's own guard for the user-facing
        // error; this is a pure internal-consistency backstop.
        throw new Error("Internal error: extern call dispatched while another is pending");
      }
      this.pendingExtern = { extern: func, args };
      return;
    }

    // A primitive referenced as a value (NEWCP) rather than called directly
    // — e.g. `f = abs; f(-5)` — has no function-table entry/frame of its
    // own; dispatch it the same way CALLP/CALLTP do.
    if (isPVMLObject(func) && func.type === "primitive") {
      // Prepend any args already bound to this primitive value — see
      // PVMLPrimitive's `boundArgs` doc comment (used by stream()'s
      // recursive continuation).
      const fullArgs = func.boundArgs ? [...func.boundArgs, ...args] : args;
      const result = executePrimitive(
        func.primitiveIndex,
        fullArgs,
        this.onOutput,
        (f, a) => this.invokeValue(f, a),
        this.variant,
      );
      this.push(result);
      return;
    }

    if (!isPVMLObject(func) || func.type !== "closure") {
      // A proper PVMLInterpreterError (matching real Python's `TypeError: 'int' object is
      // not callable`), not a plain JS Error — so this surfaces as a normal Python-level
      // exception, consistent with every other type check in this file (e.g. arity()'s
      // "must be a function" check in builtins.ts), rather than an uncaught JS error.
      throw new PVMLInterpreterError(`TypeError: '${getPVMLType(func)}' object is not callable`);
    }

    const closure = func;

    // Dispatch through the closure's own captured code reference, not an
    // index into `this.program.functions` — the closure may have been
    // created by a *different*, earlier compilation (see PVMLClosure's `ir`
    // field doc), so `this.program` (this interpreter instance's own,
    // possibly unrelated, program) may not even have an entry at that index.
    const funcDef = closure.ir;

    // A rest param (`def f(a, *rest)`, always the last parameter — see
    // PVMLIR's `hasRestParam` doc comment) absorbs every argument from its
    // own slot index onward into a single array, so the arity check only
    // requires *at least* enough args to fill the fixed params before it.
    const numFixedParams = funcDef.hasRestParam ? funcDef.numArgs - 1 : funcDef.numArgs;
    if (funcDef.hasRestParam) {
      if (numArgs < numFixedParams) {
        throw new Error(`Function expects at least ${numFixedParams} arguments but got ${numArgs}`);
      }
    } else if (numArgs !== funcDef.numArgs) {
      throw new Error(`Function expects ${funcDef.numArgs} arguments but got ${numArgs}`);
    }

    const newEnv = new PVMLEnvironment(funcDef.envSize, closure.parentEnv);
    for (let i = 0; i < numFixedParams; i++) {
      newEnv.set(i, args[i]);
      if (__DEBUG__)
        debug(`[CALL] Set env slot ${i} = ${JSON.stringify(PVMLInterpreter.toJSValue(args[i]))}`);
    }
    if (funcDef.hasRestParam) {
      const restArgs: PVMLArray = { type: "array", elements: args.slice(numFixedParams) };
      // A flat, arbitrary-length collection - the same category as a list literal, not a
      // pair()/llist() chain - so module interop needs the same tag to reconstruct it as a proper
      // list rather than misreading an exactly-2-arg case as a dotted pair. See
      // pvmlListLiteralArrays' doc comment in types.ts.
      pvmlListLiteralArrays.add(restArgs);
      newEnv.set(numFixedParams, restArgs);
      if (__DEBUG__)
        debug(
          `[CALL] Set rest-param env slot ${numFixedParams} = ${JSON.stringify(PVMLInterpreter.toJSValue(restArgs))}`,
        );
    }

    if (__DEBUG__)
      debug(
        `[CALL] Created new env with ${funcDef.envSize} slots, parent exists: ${closure.parentEnv !== null}`,
      );

    if (isTailCall) {
      // Reachable only when currentFrame is non-null - the guard at the top of this method
      // already throws otherwise - but written out again here so TS can narrow it (that guard's
      // null check is conditional on isTailCall, so it doesn't narrow this far on its own).
      if (!this.currentFrame) {
        throw new Error("No current frame");
      }
      this.currentFrame.closure = closure;
      this.currentFrame.ir = funcDef;
      this.currentFrame.pc = 0;
      this.currentFrame.env = newEnv;
      this.currentFrame.stack = [];
    } else {
      const newFrame: CallFrame = {
        closure,
        ir: funcDef,
        pc: 0,
        env: newEnv,
        stack: [],
        callerFrame: this.currentFrame,
      };
      this.currentFrame = newFrame;
      this.callDepth++;
    }
  }

  /**
   * Synchronously invokes an arbitrary callee value with a given argument
   * list, from *outside* the normal bytecode dispatch loop — used by
   * primitives that need to call back into user code (e.g.
   * `apply_in_underlying_python`, see builtins.ts), which are themselves
   * dispatched synchronously from `step()` and so cannot await anything.
   * For a `PVMLPrimitive` callee, `dispatchCall` resolves this immediately,
   * no frame involved at all. For a `PVMLClosure` callee, `dispatchCall`
   * (called with `isTailCall: false`, so it always pushes a *new* frame
   * rather than reusing the current one) sets `this.currentFrame` to that
   * new frame, whose `callerFrame` is the frame that was executing when
   * `invokeValue` was called (`origFrame`) — `return()` already unwinds
   * `currentFrame` back to `callerFrame` when the nested call's RETG/etc.
   * executes, so driving `step()` in a loop until `currentFrame` is back to
   * `origFrame` runs the nested call to completion synchronously. This
   * works because `run()`/`step()` are already just a flat loop over
   * single-instruction steps driven by `currentFrame`/`callerFrame` links
   * (unlike the CSE machine's control/stash architecture), so recursing
   * into it from a primitive needs no special resumable-step-machine
   * support.
   *
   * If `func`'s own execution needs to call an imported module function
   * (an extern) — including if `func` itself turns out to be one, e.g. a
   * closure created by one module and later invoked by another (sound's
   * sine_sound producing a wave that play() later samples) — this throws a
   * clear error rather than deadlocking, since a primitive's synchronous
   * caller has no way to await the pending call. See `invokeValueAsync` for
   * the counterpart used by callers that *can* await (every module-callback
   * re-entry point - PVMLHostCall's doc comment).
   */
  private invokeValue(func: PVMLBoxType, args: PVMLBoxType[]): PVMLBoxType {
    const origFrame = this.currentFrame;
    if (!origFrame) {
      throw new Error("No current frame");
    }

    this.dispatchCall(func, args, false);

    // dispatchCall's extern branch (see its own doc comment) never touches currentFrame at all -
    // it just parks pendingExtern and returns, whether func itself is the extern (this call sets
    // pendingExtern with currentFrame still === origFrame, so the loop below would never run even
    // once) or func's own body makes a nested extern call partway through stepping (pendingExtern
    // appears while currentFrame !== origFrame, mid-loop). The condition checks pendingExtern
    // first specifically to catch the former case - previously only the latter was handled, so a
    // func that was itself an extern silently fell through to `this.pop()` on a stack nothing had
    // been pushed to ("Stack underflow"), instead of the clear error below.
    while (this.pendingExtern || (this.currentFrame && this.currentFrame !== origFrame)) {
      if (this.pendingExtern) {
        // This loop is synchronous - it cannot await the parked async extern call the way
        // executeAsync's driver loop (or invokeValueAsync, below) does, so there is no way to
        // honour this nested call from here. Surface a clear error rather than deadlocking on a
        // result that will never arrive.
        const name = this.pendingExtern.extern.name;
        this.pendingExtern = undefined;
        throw new PVMLInterpreterError(
          `RuntimeError: cannot call imported module function '${name}' from inside a ` +
            `callback that was itself invoked by a module or primitive`,
        );
      }
      this.step();
    }

    return this.pop();
  }

  /**
   * The async counterpart to `invokeValue`, for the one class of caller that
   * genuinely can await a pending nested extern call instead of having to
   * reject it: every module-callback re-entry point (PVMLHostCall, passed to
   * a PVMLExtern's `fn`) is already an async function, all the way through
   * modules.ts's conversion helpers - there is no synchronous context here
   * that needs protecting the way `invokeValue`'s primitive-dispatch callers
   * do. Otherwise identical to `invokeValue`: same frame-based nested-call
   * mechanism, just awaiting `extern.fn` (mirroring `executeAsync`'s own
   * driver loop) instead of throwing when `pendingExtern` appears.
   *
   * Unlike `invokeValue`, `origFrame` here may legitimately be `null`: a
   * scheduled callback (e.g. sound_matrix's `set_timeout`) fires from a real
   * JS timer that can run well after the top-level chunk's own
   * `executeAsync()` has already returned and unwound `currentFrame` back to
   * null (and reset `allowExtern` to false in its `finally`). That isn't a
   * broken state to reject - it just means this call is now the top-level
   * driver instead of a nested one. `dispatchCall` builds a fresh frame with
   * `callerFrame: null` in that case (see its own doc comment), and the loop
   * below already terminates correctly either way: "until currentFrame is
   * back to origFrame" reads as "until currentFrame is null again" when
   * `origFrame` is null, exactly matching a self-contained sub-run. Without
   * this, any module call made from inside a `set_timeout` callback that
   * fires after the chunk finished (i.e. the second scheduled call onward)
   * threw "No current frame" inside the callback's async generator, silently
   * discarded by sound_matrix's fire-and-forget `void drainGenerator(...)` -
   * the recursion just stopped with no visible error.
   */
  private async invokeValueAsync(func: PVMLBoxType, args: PVMLBoxType[]): Promise<PVMLBoxType> {
    const origFrame = this.currentFrame;
    const wasAllowExtern = this.allowExtern;
    this.allowExtern = true;
    try {
      this.dispatchCall(func, args, false);

      while (this.pendingExtern || (this.currentFrame && this.currentFrame !== origFrame)) {
        if (this.pendingExtern) {
          const { extern, args: externArgs } = this.pendingExtern;
          this.pendingExtern = undefined;
          this.push(await extern.fn(externArgs, (f, a) => this.invokeValueAsync(f, a)));
          continue;
        }
        this.step();
      }

      return this.pop();
    } finally {
      this.allowExtern = wasAllowExtern;
    }
  }

  private callPrimitive(primitiveIndex: number, numArgs: number): void {
    if (__DEBUG__) debug(`[CALLP] primitiveIndex=${primitiveIndex}, numArgs=${numArgs}`);

    // Primitives pop N arguments only — no function object on the stack
    const args = new Array<PVMLBoxType>(numArgs);
    for (let i = numArgs - 1; i >= 0; i--) {
      if (this.currentFrame?.stack.length === 0) {
        throw new Error(`Stack underflow in primitive call while popping argument ${i}/${numArgs}`);
      }
      args[i] = this.pop();
    }

    if (__DEBUG__)
      debug(
        `[CALLP] Calling primitive ${primitiveIndex} with args: ${JSON.stringify(args.map(a => PVMLInterpreter.toJSValue(a)))}`,
      );

    const result = executePrimitive(
      primitiveIndex,
      args,
      this.onOutput,
      (f, a) => this.invokeValue(f, a),
      this.variant,
    );
    this.push(result);

    if (__DEBUG__)
      debug(`[CALLP] Primitive returned: ${JSON.stringify(PVMLInterpreter.toJSValue(result))}`);
  }

  private return(): void {
    if (!this.currentFrame) {
      throw new Error("No current frame");
    }

    // Pop return value from CURRENT (callee's) stack
    const returnValue = this.pop();

    if (__DEBUG__)
      debug(`[RETG] Returning value: ${JSON.stringify(PVMLInterpreter.toJSValue(returnValue))}`);

    const callerFrame = this.currentFrame.callerFrame;

    if (!callerFrame) {
      this.halted = true;
      this.push(returnValue);
      return;
    }

    this.currentFrame = callerFrame;
    this.callDepth--;
    this.push(returnValue);

    if (__DEBUG__)
      debug(
        `[RETG] Pushed return value to caller's stack, size now: ${this.currentFrame.stack.length}`,
      );
  }

  // ========================================================================
  // Array Operations
  // ========================================================================

  private createArray(size: number): void {
    // Native-Pynter-targeted bytecode always emits NEWA with no operand
    // (encoded as 0) and grows it element-by-element via STAG afterwards, to
    // exactly match native Pynter's own op_new_a/siarray_put -- see
    // visitListExpr's targetsPynter branch. Browser-pathway (non-Pynter)
    // compilation instead pre-sizes the array here, since storeArrayElement
    // no longer auto-grows (issue #294) and the resulting slots are always
    // overwritten by the STAG loop that immediately follows, in range.
    const arr: PVMLArray = {
      type: "array",
      elements: new Array<PVMLBoxType>(size).fill(undefined),
    };
    this.push(arr);
  }

  private loadArrayElement(): void {
    const indexValue = this.pop();
    const arr = this.pop();

    if (this.legacyArraySemantics) {
      const idx = Number(indexValue);
      const elements = typeof arr === "string" ? [...arr] : (arr as PVMLArray).elements;
      // Mirrors native Pynter's siarray_get: an out-of-bounds read isn't a
      // fault, it yields undefined. See legacyArraySemantics' doc comment.
      this.push(idx >= 0 && idx < elements.length ? elements[idx] : undefined);
      return;
    }

    // `bool` is deliberately rejected as an index, unlike real Python (see
    // docs/specs/python_typing_middle_34.tex) -- a Python `int` is always a
    // JS `bigint` on this pathway (PVMLType.BIGINT), so this also catches
    // float/str/list/etc. indices, not just bool.
    if (typeof indexValue !== "bigint") {
      throw new ListIndexTypeError();
    }
    const idx = Number(indexValue);

    if (typeof arr === "string") {
      // Python's str is a sequence of Unicode code points, not UTF-16 code
      // units — the spread operator splits on code points (surrogate pairs
      // included), matching len()'s identical use of it (see builtins.ts's
      // case 2) so e.g. '👨‍👩‍👧‍👦'[1] is the lone ZWJ code point between the
      // first two family-emoji members, not half a surrogate pair.
      const codePoints = [...arr];
      const length = codePoints.length;
      // Mirrors the CSE machine's LIST_ACCESS, which likewise has no
      // separate "string index out of range" wording.
      if (idx < -length || idx >= length) {
        throw new IndexError();
      }
      this.push(codePoints[idx < 0 ? idx + length : idx]);
      return;
    }

    if (!isPVMLObject(arr) || arr.type !== "array") {
      throw new Error("Cannot index non-array value");
    }

    const length = arr.elements.length;
    // Valid range is -length..length-1, with negative indices wrapping
    // (docs/specs/python_typing_middle_34.tex) -- no longer "an out-of-bounds
    // read isn't a fault, it yields undefined" as native Pynter's siarray_get
    // does; that diverged from the Python §3/§4 spec.
    if (idx < -length || idx >= length) {
      throw new IndexError();
    }
    this.push(arr.elements[idx < 0 ? idx + length : idx]);
  }

  private storeArrayElement(): void {
    const value = this.pop();
    const indexValue = this.pop();
    const arr = this.pop();

    if (!isPVMLObject(arr) || arr.type !== "array") {
      throw new Error("Cannot index non-array value");
    }

    if (this.legacyArraySemantics) {
      const idx = Number(indexValue);
      if (idx < 0) {
        throw new Error(`Array index ${idx} out of bounds`);
      }
      // Mirrors native Pynter's siarray_put: writing past the end grows the
      // array (leaving a gap of `undefined`s) rather than faulting. See
      // legacyArraySemantics' doc comment.
      arr.elements[idx] = value;
      return;
    }

    if (typeof indexValue !== "bigint") {
      throw new ListIndexTypeError();
    }
    const idx = Number(indexValue);
    const length = arr.elements.length;

    // No auto-grow (issue #294): unlike native Pynter's siarray_put, writing
    // past the end always raises rather than growing the array, matching the
    // CSE machine and docs/specs/python_typing_middle_34.tex.
    if (idx < -length || idx >= length) {
      throw new IndexError(true);
    }
    arr.elements[idx < 0 ? idx + length : idx] = value;
  }

  /**
   * `list * int` / `int * list`: repeats `arr`'s elements `count` times as
   * shallow copies (the same `PVMLBoxType` references, not deep clones), or
   * `[]` for `count <= 0` — see docs/specs/python_typing_middle_34.tex.
   */
  private repeatArray(arr: PVMLArray, count: bigint): PVMLArray {
    const elements: PVMLBoxType[] = [];
    for (let i = 0n; i < count; i++) {
      for (const el of arr.elements) {
        elements.push(el);
      }
    }
    const repeated: PVMLArray = { type: "array", elements };
    // A `[a, b]`-shaped result must still round-trip through a module
    // boundary as a genuine list, not be misidentified as a dotted pair —
    // see pvmlListLiteralArrays' doc comment in types.ts.
    pvmlListLiteralArrays.add(repeated);
    return repeated;
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Convert runtime value to JavaScript value for display
   */
  static toJSValue(value: PVMLBoxType): unknown {
    if (value === null || value === undefined) return value;
    if (
      typeof value === "number" ||
      typeof value === "bigint" ||
      typeof value === "boolean" ||
      typeof value === "string"
    )
      return value;
    // Complex numbers are stringified here rather than passed through as the
    // raw PyComplexNumber object (unlike bigint above, which structured-clones
    // natively) — a plain class instance isn't guaranteed to survive a
    // conductor/postMessage boundary the way a bigint primitive does, and
    // `.toString()` already matches this value's str()/repr() rendering
    // (see cse-interop.ts) exactly.
    if (value instanceof PyComplexNumber) return value.toString();
    if (isPVMLObject(value)) {
      if (value.type === "closure") return `<closure:${value.functionIndex}>`;
      if (value.type === "primitive") return `<primitive:${value.primitiveIndex}>`;
      if (value.type === "array") return value.elements.map(e => PVMLInterpreter.toJSValue(e));
      if (value.type === "iterator") return `<iterator>`;
      if (value.type === "opaque") return `<opaque>`;
      if (value.type === "extern") return `<module function:${value.name}>`;
    }
    return String(value);
  }
}
