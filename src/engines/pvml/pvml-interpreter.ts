import { numericCompare, pythonMod } from "../cse/utils";
import { PyComplexNumber } from "../../types";
import { executePrimitive } from "./builtins";
import { PVMLInterpreterError, UnsupportedOperandTypeError, ZeroDivisionError } from "./errors";
import OpCodes from "./opcodes";
import {
  getPVMLType,
  isPVMLObject,
  PVMLArray,
  PVMLBoxType,
  PVMLClosure,
  PVMLEnvironment,
  PVMLIR,
  PVMLIterator,
  PVMLProgram,
  PVMLType,
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
  private maxInstructionLimit: number = 1000000;

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
    },
  ) {
    this.program = program;
    this.currentFrame = null;
    this.globalEnv = options?.globalEnv ?? new Map();
    this.halted = false;
    this.onOutput = options?.sendOutput ?? (() => {});

    if (options) {
      if (options.maxStackSize) this.maxStackSize = options.maxStackSize;
      if (options.maxCallDepth) this.maxCallDepth = options.maxCallDepth;
      if (options.maxInstructions) this.maxInstructionLimit = options.maxInstructions;
    }
  }

  /** The current global environment (see `globalEnv` above) — retrieve after
   * `execute()` to thread into a later PVMLInterpreter instance for a REPL's
   * next chunk, so it sees this chunk's global variable/function definitions. */
  getGlobalEnv(): Map<string, PVMLBoxType> {
    return this.globalEnv;
  }

  /**
   * Execute the program and return the result
   */
  execute(): PVMLBoxType {
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

    return this.run();
  }

  /**
   * Main interpreter loop — dispatch from typed arrays
   */
  private run(): PVMLBoxType {
    while (!this.halted && this.currentFrame) {
      this.step();
    }

    // Return top of stack or undefined
    return this.currentFrame && this.currentFrame.stack.length > 0
      ? this.currentFrame.stack[this.currentFrame.stack.length - 1]
      : undefined;
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
      case OpCodes.LDGG:
        this.push(this.globalEnv.get(ir.strings[a1]));
        break;

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
          throw new UnsupportedOperandTypeError("+", leftType, rightType);
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
          throw new UnsupportedOperandTypeError("-", leftType, rightType);
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

        if (isArithmeticValue(left) && isArithmeticValue(right)) {
          this.push(PVMLInterpreter.numericArith("*", left, right));
        } else {
          throw new UnsupportedOperandTypeError("*", leftType, rightType);
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
          throw new UnsupportedOperandTypeError("/", leftType, rightType);
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
          throw new UnsupportedOperandTypeError("//", leftType, rightType);
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
          throw new UnsupportedOperandTypeError("%", leftType, rightType);
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
          throw new UnsupportedOperandTypeError("**", leftType, rightType);
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
          throw new UnsupportedOperandTypeError("-", operandType);
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
          throw new UnsupportedOperandTypeError("not", getPVMLType(operand));
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
        this.createArray();
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

  private strictEqual(): void {
    const right = PVMLInterpreter.asNumberIfBool(this.pop());
    const left = PVMLInterpreter.asNumberIfBool(this.pop());
    if (isArithmeticValue(left) && isArithmeticValue(right)) {
      this.push(PVMLInterpreter.numericEquals(left, right));
    } else {
      this.push(left === right);
    }
  }

  private strictNotEqual(): void {
    const right = PVMLInterpreter.asNumberIfBool(this.pop());
    const left = PVMLInterpreter.asNumberIfBool(this.pop());
    if (isArithmeticValue(left) && isArithmeticValue(right)) {
      this.push(!PVMLInterpreter.numericEquals(left, right));
    } else {
      this.push(left !== right);
    }
  }

  /** §1/§2's `==`/`!=` (see docs/specs/python_typing_middle_12.tex): bool and
   * function values (closures/primitives) are excluded entirely, even against
   * each other (`True == True` is an error, not `true`) — unlike §3/§4, there
   * is no bool-as-int coercion here at all. */
  private strictEqual12(): void {
    const right = this.pop();
    const left = this.pop();
    const leftType = getPVMLType(left);
    const rightType = getPVMLType(right);
    if (isExcludedFromChapter12Equality(left) || isExcludedFromChapter12Equality(right)) {
      throw new UnsupportedOperandTypeError("==", leftType, rightType);
    }
    if (isArithmeticValue(left) && isArithmeticValue(right)) {
      this.push(PVMLInterpreter.numericEquals(left, right));
    } else {
      this.push(left === right);
    }
  }

  private strictNotEqual12(): void {
    const right = this.pop();
    const left = this.pop();
    const leftType = getPVMLType(left);
    const rightType = getPVMLType(right);
    if (isExcludedFromChapter12Equality(left) || isExcludedFromChapter12Equality(right)) {
      throw new UnsupportedOperandTypeError("!=", leftType, rightType);
    }
    if (isArithmeticValue(left) && isArithmeticValue(right)) {
      this.push(!PVMLInterpreter.numericEquals(left, right));
    } else {
      this.push(left !== right);
    }
  }

  /**
   * `is`: Python pointer/identity equality, as distinct from `==`'s structural
   * equality (see docs/specs/python_typing_tail_34.tex). Arrays and closures
   * are boxed JS objects here, so `===` already compares them by reference —
   * two separately-built lists with equal elements are `is`-unequal even
   * though `==`-equal. Scalars (number/string/boolean/None) have no separate
   * identity in this representation, so `===` on them doubles as identity;
   * this still satisfies the spec's only hard guarantee (`None`/`True`/`False`
   * are each a single instance system-wide), since JS gives that for free.
   * Deliberately no bool-as-int coercion (unlike EQG/NEQG above) — `1 is True`
   * must be false, since `is` never treats values of different types as equal.
   */
  private identityEqual(): void {
    const right = this.pop();
    const left = this.pop();
    this.push(left === right);
  }

  private identityNotEqual(): void {
    const right = this.pop();
    const left = this.pop();
    this.push(left !== right);
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
    throw new UnsupportedOperandTypeError(op, leftType, rightType);
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
    throw new UnsupportedOperandTypeError(op, leftType, rightType);
  }

  // ========================================================================
  // Variable Operations
  // ========================================================================

  private loadLocal(slot: number): void {
    if (!this.currentFrame) {
      throw new Error("No current frame");
    }
    const value = this.currentFrame.env.get(slot);
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
      throw new UnsupportedOperandTypeError("branch", getPVMLType(condition));
    }
    if (condition) {
      this.branch(offset);
    }
  }

  private branchIfFalse(offset: number): void {
    const condition = this.pop();
    if (typeof condition !== "boolean") {
      throw new UnsupportedOperandTypeError("branch", getPVMLType(condition));
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

    const ir = this.program.functions[functionIndex];
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
    if (!this.currentFrame) {
      throw new Error("No current frame");
    }

    if (!isTailCall && this.callDepth >= this.maxCallDepth) {
      throw new Error(`Maximum call depth exceeded (${this.maxCallDepth})`);
    }

    const numArgs = args.length;

    // A primitive referenced as a value (NEWCP) rather than called directly
    // — e.g. `f = abs; f(-5)` — has no function-table entry/frame of its
    // own; dispatch it the same way CALLP/CALLTP do.
    if (isPVMLObject(func) && func.type === "primitive") {
      // Prepend any args already bound to this primitive value — see
      // PVMLPrimitive's `boundArgs` doc comment (used by stream()'s
      // recursive continuation).
      const fullArgs = func.boundArgs ? [...func.boundArgs, ...args] : args;
      const result = executePrimitive(func.primitiveIndex, fullArgs, this.onOutput, (f, a) =>
        this.invokeValue(f, a),
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
   * `apply_in_underlying_python`, see builtins.ts). For a `PVMLPrimitive`
   * callee, `dispatchCall` resolves this immediately, no frame involved at
   * all. For a `PVMLClosure` callee, `dispatchCall` (called with
   * `isTailCall: false`, so it always pushes a *new* frame rather than
   * reusing the current one) sets `this.currentFrame` to that new frame,
   * whose `callerFrame` is the frame that was executing when `invokeValue`
   * was called (`origFrame`) — `return()` already unwinds `currentFrame`
   * back to `callerFrame` when the nested call's RETG/etc. executes, so
   * driving `step()` in a loop until `currentFrame` is back to `origFrame`
   * runs the nested call to completion synchronously. This works because
   * `run()`/`step()` are already just a flat loop over single-instruction
   * steps driven by `currentFrame`/`callerFrame` links (unlike the CSE
   * machine's control/stash architecture), so recursing into it from a
   * primitive needs no special resumable-step-machine support.
   */
  private invokeValue(func: PVMLBoxType, args: PVMLBoxType[]): PVMLBoxType {
    const origFrame = this.currentFrame;
    if (!origFrame) {
      throw new Error("No current frame");
    }

    this.dispatchCall(func, args, false);

    while (this.currentFrame && this.currentFrame !== origFrame) {
      this.step();
    }

    return this.pop();
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

    const result = executePrimitive(primitiveIndex, args, this.onOutput, (f, a) =>
      this.invokeValue(f, a),
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

  private createArray(): void {
    // No size operand: native Pynter's NEWA (op_new_a) always creates an
    // empty, auto-growing array and never pops one — see visitListExpr.
    const arr: PVMLArray = {
      type: "array",
      elements: [],
    };
    this.push(arr);
  }

  private loadArrayElement(): void {
    const index = this.pop() as number;
    const arr = this.pop();

    if (!isPVMLObject(arr) || arr.type !== "array") {
      throw new Error("Cannot index non-array value");
    }

    // Mirrors native Pynter's siarray_get: an out-of-bounds read isn't a
    // fault, it yields undefined.
    this.push(index >= 0 && index < arr.elements.length ? arr.elements[index] : undefined);
  }

  private storeArrayElement(): void {
    const value = this.pop();
    const index = this.pop() as number;
    const arr = this.pop();

    if (!isPVMLObject(arr) || arr.type !== "array") {
      throw new Error("Cannot index non-array value");
    }

    if (index < 0) {
      throw new Error(`Array index ${index} out of bounds`);
    }

    // Mirrors native Pynter's siarray_put: writing past the end grows the
    // array (leaving a gap of `undefined`s) rather than faulting.
    arr.elements[index] = value;
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
    }
    return String(value);
  }
}
