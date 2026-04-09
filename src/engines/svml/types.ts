export type SVMLBoxType =
  | number
  | boolean
  | string
  | null
  | undefined
  | SVMLClosure
  | SVMLArray
  | SVMLIterator;

export enum SVMLType {
  UNDEFINED = "undefined",
  NULL = "null",
  BOOLEAN = "boolean",
  NUMBER = "number",
  STRING = "string",
  ARRAY = "array",
  CLOSURE = "closure",
  ITERATOR = "iterator",
}

export interface SVMLArray {
  type: "array";
  elements: SVMLBoxType[];
}

export interface SVMLIterator {
  type: "iterator";
  kind: "range" | "list";
  // range fields
  current?: number;
  stop?: number;
  step?: number;
  // list fields
  array?: SVMLArray;
  index?: number;
}

export interface SVMLClosure {
  type: "closure";
  functionIndex: number;
  parentEnv: SVMLEnvironment | null;
  isMemoized?: boolean;
  memoCache?: Map<string, SVMLBoxType>;
}

/** Type guard: narrows SVMLBoxType to the three object variants. */
export function isSVMLObject(value: SVMLBoxType): value is SVMLClosure | SVMLArray | SVMLIterator {
  return typeof value === "object" && value !== null && "type" in value;
}

export class SVMLEnvironment {
  private locals: SVMLBoxType[];
  private parent: SVMLEnvironment | null;

  constructor(size: number, parent: SVMLEnvironment | null = null) {
    this.locals = new Array(size).fill(undefined);
    this.parent = parent;
  }

  get(slot: number): SVMLBoxType {
    if (slot < 0 || slot >= this.locals.length) {
      throw new Error(`Environment slot ${slot} out of bounds (size: ${this.locals.length})`);
    }
    return this.locals[slot];
  }

  set(slot: number, value: SVMLBoxType): void {
    if (slot < 0 || slot >= this.locals.length) {
      throw new Error(`Environment slot ${slot} out of bounds (size: ${this.locals.length})`);
    }
    this.locals[slot] = value;
  }

  getParent(level: number): SVMLEnvironment {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let env: SVMLEnvironment | null = this;
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

/** @deprecated Use SVMLIR typed arrays directly */
export interface Instruction {
  opcode: number;
  arg1?: SVMLBoxType;
  arg2?: SVMLBoxType;
}

// ========================================================================
// SVMLIR: immutable IR for a single function
// ========================================================================

import OpCodes from "./opcodes";

/**
 * IR representation of a single compiled function.
 *
 * Produced by SVMLIRBuilder.build() and consumed by SVMLInterpreter.
 * Uses struct-of-arrays typed arrays for cache-friendly dispatch.
 */
export class SVMLIR {
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
      if (opcode === OpCodes.LGCS) {
        result.push({ opcode, arg1: this.strings[this.arg1s[i]] });
      } else {
        result.push({ opcode, arg1: this.arg1s[i], arg2: this.arg2s[i] });
      }
    }
    return result;
  }
}

// ========================================================================
// SVMLProgram: immutable collection of SVMLIR functions
// ========================================================================

/**
 * Immutable program representation: an entry point index and a list of SVMLIR functions.
 * Frozen after construction.
 */
export class SVMLProgram {
  readonly entryPoint: number;
  readonly functions: readonly SVMLIR[];
  constructor(entryPoint: number, functions: SVMLIR[]) {
    this.entryPoint = entryPoint;
    this.functions = Object.freeze([...functions]);
    Object.freeze(this);
  }

  /** Return a new program with one function replaced by a specialized variant. */
  withSpecializedFunction(index: number, newIR: SVMLIR): SVMLProgram {
    const fns = [...this.functions];
    fns[index] = newIR;
    return new SVMLProgram(this.entryPoint, fns);
  }
}

export function getSVMLType(value: SVMLBoxType): SVMLType {
  if (typeof value === "number") {
    return SVMLType.NUMBER;
  } else if (typeof value === "string") {
    return SVMLType.STRING;
  } else if (typeof value === "boolean") {
    return SVMLType.BOOLEAN;
  } else if (value === null) {
    return SVMLType.NULL;
  } else if (value === undefined) {
    return SVMLType.UNDEFINED;
  } else if (isSVMLObject(value)) {
    switch (value.type) {
      case "closure":
        return SVMLType.CLOSURE;
      case "array":
        return SVMLType.ARRAY;
      case "iterator":
        return SVMLType.ITERATOR;
    }
  }
  throw new Error(`Unknown runtime type: ${typeof value}`);
}
