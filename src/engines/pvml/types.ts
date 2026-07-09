import { PyComplexNumber } from "../../types";

export type PVMLBoxType =
  | number
  | bigint
  | boolean
  | string
  | null
  | undefined
  | PyComplexNumber
  | PVMLClosure
  | PVMLPrimitive
  | PVMLArray
  | PVMLIterator;

export enum PVMLType {
  UNDEFINED = "undefined",
  NULL = "null",
  BOOLEAN = "boolean",
  /** A Python float (JS `number`). See BIGINT below for Python `int`. */
  NUMBER = "number",
  /** A Python int (JS `bigint`, arbitrary precision) — distinct from NUMBER
   * (float), matching the CSE machine's own int/float split. Browser-pathway
   * only (see PVMLIR's `bigints` field doc comment); native Pynter has no
   * equivalent, and isn't meant to. */
  BIGINT = "bigint",
  /** A Python complex number (the shared, engine-agnostic `PyComplexNumber`
   * class — see cse-interop.ts and PVMLIR's `complexes` field doc comment).
   * Browser-pathway only; native Pynter has zero complex-number support. */
  COMPLEX = "complex",
  STRING = "string",
  ARRAY = "array",
  CLOSURE = "closure",
  PRIMITIVE = "primitive",
  ITERATOR = "iterator",
}

export interface PVMLArray {
  type: "array";
  elements: PVMLBoxType[];
}

export interface PVMLIterator {
  type: "iterator";
  kind: "range" | "list";
  // range fields — bigint, since range() must preserve Python `int`-ness of
  // its values (see builtins.ts's assertIntArgs)
  current?: bigint;
  stop?: bigint;
  step?: bigint;
  // list fields
  array?: PVMLArray;
  index?: number;
}

export interface PVMLClosure {
  type: "closure";
  /**
   * Direct reference to the closure's compiled code, resolved once at
   * closure-creation time (NEWC) rather than re-resolved via a numeric index
   * into "whichever program is currently running" at every call. This makes
   * closures portable across independently-compiled programs — needed once a
   * closure can outlive the single compilation that created it, e.g. a
   * prelude-defined function stored in PVMLInterpreter's persistent global
   * environment and called from a later, separately-compiled REPL chunk
   * (see PVMLCompiler's `useGlobalMap`/PVMLInterpreter's globalEnv).
   */
  ir: PVMLIR;
  /** The function's index in the program that originally compiled it — for
   * debug/display only (e.g. toJSValue's `<closure:N>`); never used for call
   * dispatch, which goes through `ir` directly. */
  functionIndex: number;
  parentEnv: PVMLEnvironment | null;
}

/**
 * A reference to a primitive function (e.g. `print`, `abs`) used as a
 * first-class value rather than called directly — e.g. `is_function(print)`
 * or `f = abs; f(-5)`. Mirrors native Pynter's "ifn" nanbox tag, which
 * likewise represents a primitive function reference distinctly from a
 * user-defined closure.
 */
export interface PVMLPrimitive {
  type: "primitive";
  primitiveIndex: number;
  /**
   * Arguments already supplied to a partially-applied primitive — used only
   * by `stream()`'s recursive continuation (primitive index 76): each call
   * returns `pair(head, <continuation with the remaining args bound>)`
   * rather than a freshly synthesized closure (which this TS interpreter, or
   * native Pynter, can't build at runtime — see builtins.ts case 76). When a
   * `PVMLPrimitive` value with `boundArgs` is later called,
   * `PVMLInterpreter.dispatchCall` prepends `boundArgs` to the call's actual
   * arguments before dispatching. Absent/undefined for every other
   * primitive.
   */
  boundArgs?: PVMLBoxType[];
}

/** Type guard: narrows PVMLBoxType to the object variants. */
export function isPVMLObject(
  value: PVMLBoxType,
): value is PVMLClosure | PVMLPrimitive | PVMLArray | PVMLIterator {
  return typeof value === "object" && value !== null && "type" in value;
}

export class PVMLEnvironment {
  private locals: PVMLBoxType[];
  private parent: PVMLEnvironment | null;

  constructor(size: number, parent: PVMLEnvironment | null = null) {
    this.locals = new Array(size).fill(undefined);
    this.parent = parent;
  }

  get(slot: number): PVMLBoxType {
    if (slot < 0 || slot >= this.locals.length) {
      throw new Error(`Environment slot ${slot} out of bounds (size: ${this.locals.length})`);
    }
    return this.locals[slot];
  }

  set(slot: number, value: PVMLBoxType): void {
    if (slot < 0 || slot >= this.locals.length) {
      throw new Error(`Environment slot ${slot} out of bounds (size: ${this.locals.length})`);
    }
    this.locals[slot] = value;
  }

  getParent(level: number): PVMLEnvironment {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let env: PVMLEnvironment | null = this;
    for (let i = 0; i < level; i++) {
      if (!env.parent) {
        throw new Error(`No parent environment at level ${level}`);
      }
      env = env.parent;
    }
    return env;
  }

  getSize(): number {
    return this.locals.length;
  }
}

/** @deprecated Use PVMLIR typed arrays directly */
export interface Instruction {
  opcode: number;
  arg1?: PVMLBoxType;
  arg2?: PVMLBoxType;
}

// ========================================================================
// PVMLIR: immutable IR for a single function
// ========================================================================

import OpCodes from "./opcodes";

/**
 * IR representation of a single compiled function.
 *
 * Produced by PVMLIRBuilder.build() and consumed by PVMLInterpreter.
 * Uses struct-of-arrays typed arrays for cache-friendly dispatch.
 */
export class PVMLIR {
  readonly opcodes: Int32Array;
  readonly arg1s: Float64Array;
  readonly arg2s: Int32Array;
  readonly strings: readonly string[];
  /** Constant pool for arbitrary-precision int literals (LGCBI) — mirrors
   * `strings` exactly, but for `bigint` instead of `string`. Needed because
   * `arg1s` is a Float64Array: it can only carry values exactly representable
   * as a 64-bit float, so a big int literal's actual value is interned here
   * and `arg1s` just holds the index. A py-slang-only, browser-pathway
   * extension — see opcodes.ts's LGCBI doc comment for why native Pynter
   * (and the rest of this codebase's arithmetic, historically) never needed
   * this: Pynter's NaN-boxed ints top out at 20 bits by design, nowhere near
   * needing a separate constant pool. */
  readonly bigints: readonly bigint[];
  /** Constant pool for complex literals (LGCC) — mirrors `bigints` exactly,
   * but for `PyComplexNumber` instead. Needed for the same reason: `arg1s`
   * (Float64Array) can't carry a real+imaginary pair, so the literal's
   * actual value is interned here and `arg1s` just holds the index. A
   * py-slang-only, browser-pathway extension — native Pynter has zero
   * complex-number support and never will (see opcodes.ts's LGCC doc
   * comment). */
  readonly complexes: readonly PyComplexNumber[];
  readonly count: number;
  readonly stackSize: number;
  readonly envSize: number;
  readonly numArgs: number;
  /** The function's declared name (a FunctionDef's name, or "(anonymous)" for
   * a lambda/multi-lambda) — display-only, used when a closure over this
   * function is formatted by str()/repr() (see cse-interop.ts). Not encoded
   * in the serialised binary format at all (a disassembled PVMLIR always
   * gets a generic placeholder — see pvml-assembler.ts), so this is a
   * browser-pathway nicety, not something native Pynter needs or has. */
  readonly functionName: string;
  /** Whether the last parameter (slot `numArgs - 1`) is a rest param
   * (`def f(a, *rest): ...`) collecting every extra positional argument into
   * a PVMLArray, rather than a plain fixed parameter. In-memory-only
   * metadata, like `functionName` — not encoded in the serialised binary
   * format (native Pynter's `targetsPynter` compile mode rejects `*args`
   * outright at compile time, so a Pynter-targeted PVMLIR never has this
   * `true` — see PVMLCompiler's visitStarredExpr). */
  readonly hasRestParam: boolean;

  constructor(
    opcodes: Int32Array,
    arg1s: Float64Array,
    arg2s: Int32Array,
    strings: string[],
    bigints: bigint[],
    stackSize: number,
    symbolCount: number,
    numArgs: number,
    functionName: string = "(anonymous)",
    complexes: PyComplexNumber[] = [],
    hasRestParam: boolean = false,
  ) {
    this.opcodes = opcodes;
    this.arg1s = arg1s;
    this.arg2s = arg2s;
    this.strings = strings;
    this.bigints = bigints;
    this.complexes = complexes;
    this.count = opcodes.length;
    this.stackSize = stackSize;
    this.envSize = symbolCount + numArgs;
    this.numArgs = numArgs;
    this.functionName = functionName;
    this.hasRestParam = hasRestParam;
  }

  /** Compatibility: reconstruct Instruction[] for assembler/debug (not hot path). */
  toInstructions(): Instruction[] {
    const result: Instruction[] = [];
    for (let i = 0; i < this.count; i++) {
      const opcode = this.opcodes[i];
      if (opcode === OpCodes.LGCS || opcode === OpCodes.LDGG || opcode === OpCodes.STGG) {
        result.push({ opcode, arg1: this.strings[this.arg1s[i]] });
      } else if (opcode === OpCodes.LGCBI) {
        result.push({ opcode, arg1: this.bigints[this.arg1s[i]] });
      } else if (opcode === OpCodes.LGCC) {
        result.push({ opcode, arg1: this.complexes[this.arg1s[i]] });
      } else {
        result.push({ opcode, arg1: this.arg1s[i], arg2: this.arg2s[i] });
      }
    }
    return result;
  }
}

// ========================================================================
// PVMLProgram: immutable collection of PVMLIR functions
// ========================================================================

/**
 * Immutable program representation: an entry point index and a list of PVMLIR functions.
 * Frozen after construction.
 */
export class PVMLProgram {
  readonly entryPoint: number;
  readonly functions: readonly PVMLIR[];
  constructor(entryPoint: number, functions: PVMLIR[]) {
    this.entryPoint = entryPoint;
    this.functions = Object.freeze([...functions]);
    Object.freeze(this);
  }

  /** Return a new program with one function replaced by a specialized variant. */
  withSpecializedFunction(index: number, newIR: PVMLIR): PVMLProgram {
    const fns = [...this.functions];
    fns[index] = newIR;
    return new PVMLProgram(this.entryPoint, fns);
  }
}

export function getPVMLType(value: PVMLBoxType): PVMLType {
  if (typeof value === "number") {
    return PVMLType.NUMBER;
  } else if (typeof value === "bigint") {
    return PVMLType.BIGINT;
  } else if (typeof value === "string") {
    return PVMLType.STRING;
  } else if (typeof value === "boolean") {
    return PVMLType.BOOLEAN;
  } else if (value === null) {
    return PVMLType.NULL;
  } else if (value === undefined) {
    return PVMLType.UNDEFINED;
  } else if (value instanceof PyComplexNumber) {
    return PVMLType.COMPLEX;
  } else if (isPVMLObject(value)) {
    switch (value.type) {
      case "closure":
        return PVMLType.CLOSURE;
      case "primitive":
        return PVMLType.PRIMITIVE;
      case "array":
        return PVMLType.ARRAY;
      case "iterator":
        return PVMLType.ITERATOR;
    }
  }
  throw new Error(`Unknown runtime type: ${typeof value}`);
}
