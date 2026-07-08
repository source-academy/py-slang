export type PVMLBoxType =
  | number
  | boolean
  | string
  | null
  | undefined
  | PVMLClosure
  | PVMLPrimitive
  | PVMLArray
  | PVMLIterator;

export enum PVMLType {
  UNDEFINED = "undefined",
  NULL = "null",
  BOOLEAN = "boolean",
  NUMBER = "number",
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
  // range fields
  current?: number;
  stop?: number;
  step?: number;
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
  readonly count: number;
  readonly stackSize: number;
  readonly envSize: number;
  readonly numArgs: number;

  constructor(
    opcodes: Int32Array,
    arg1s: Float64Array,
    arg2s: Int32Array,
    strings: string[],
    stackSize: number,
    symbolCount: number,
    numArgs: number,
  ) {
    this.opcodes = opcodes;
    this.arg1s = arg1s;
    this.arg2s = arg2s;
    this.strings = strings;
    this.count = opcodes.length;
    this.stackSize = stackSize;
    this.envSize = symbolCount + numArgs;
    this.numArgs = numArgs;
  }

  /** Compatibility: reconstruct Instruction[] for assembler/debug (not hot path). */
  toInstructions(): Instruction[] {
    const result: Instruction[] = [];
    for (let i = 0; i < this.count; i++) {
      const opcode = this.opcodes[i];
      if (opcode === OpCodes.LGCS || opcode === OpCodes.LDGG || opcode === OpCodes.STGG) {
        result.push({ opcode, arg1: this.strings[this.arg1s[i]] });
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
  } else if (typeof value === "string") {
    return PVMLType.STRING;
  } else if (typeof value === "boolean") {
    return PVMLType.BOOLEAN;
  } else if (value === null) {
    return PVMLType.NULL;
  } else if (value === undefined) {
    return PVMLType.UNDEFINED;
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
