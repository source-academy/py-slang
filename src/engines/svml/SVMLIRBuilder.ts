import OpCodes, { OPCODE_MAX } from "./opcodes";
import { SVMLBoxType, SVMLIR } from "./types";
import { SVMLCompilerError } from "./errors";

/**
 * Mutable builder for constructing SVMLIR.
 *
 * Used during compilation only. Once build() is called, the resulting
 * SVMLIR is frozen and immutable.
 */
export class SVMLIRBuilder {
  private children: SVMLIRBuilder[] = [];
  private ops: number[] = [];
  private a1s: number[] = [];
  private a2s: number[] = [];
  private strings: string[] = [];

  // Fast label tracking with numeric IDs
  private labelPositions: number[] = []; // sparse array: labelId -> instruction index
  private fixups: Array<{ instrIndex: number; labelId: number }> = [];

  // Fast metadata tracking
  private maxStackDepth: number = 0;
  private currentStackDepth: number = 0;
  private symbolCount: number = 0;
  private numArgs: number = 0;
  private functionIndex: number;
  private static _functionIndex: number = 0;

  private lastLabelId: number = 0;

  constructor(numArgs: number) {
    this.numArgs = numArgs;
    this.functionIndex = SVMLIRBuilder._functionIndex++;
  }

  static resetIndex(): void {
    SVMLIRBuilder._functionIndex = 0;
  }

  getFunctionIndex(): number {
    return this.functionIndex;
  }

  createChildBuilder(numArgs: number): SVMLIRBuilder {
    const child = new SVMLIRBuilder(numArgs);
    this.children.push(child);
    return child;
  }

  getAllBuilders(toSort: boolean = false): SVMLIRBuilder[] {
    const res = [this, ...this.children.flatMap(child => child.getAllBuilders())];
    if (!toSort) {
      return res;
    }
    return res.sort((a, b) => a.getFunctionIndex() - b.getFunctionIndex());
  }

  emitNullary(opcode: number): void {
    this.ops.push(opcode);
    this.a1s.push(0);
    this.a2s.push(0);
    this.updateStackDepth(opcode);
  }

  emitUnary(opcode: number, arg1: SVMLBoxType): void {
    this.ops.push(opcode);
    if (typeof arg1 === "string") {
      this.a1s.push(this.strings.length);
      this.strings.push(arg1);
    } else {
      this.a1s.push(arg1 as number);
    }
    this.a2s.push(0);
    this.updateStackDepth(opcode);
  }

  emitBinary(opcode: number, arg1: SVMLBoxType, arg2: SVMLBoxType): void {
    this.ops.push(opcode);
    this.a1s.push(arg1 as number);
    this.a2s.push(arg2 as number);
    this.updateStackDepth(opcode);
  }

  /** Allocate a fresh label ID without emitting or marking anything. */
  getNextLabel(): number {
    return this.lastLabelId++;
  }

  emitJump(opcode: number, labelId?: number): number {
    if (labelId === undefined) {
      labelId = this.getNextLabel();
    }
    const instrIndex = this.ops.length;
    this.fixups.push({ instrIndex, labelId });
    this.ops.push(opcode);
    this.a1s.push(0); // placeholder
    this.a2s.push(0);
    this.updateStackDepth(opcode);
    return labelId;
  }

  markLabel(labelId?: number): number {
    if (labelId === undefined) {
      labelId = this.getNextLabel();
    }
    this.labelPositions[labelId] = this.ops.length;
    return labelId;
  }

  emitPrimitiveCall(opcode: number, primitiveIndex: number, numArgs: number): void {
    this.ops.push(opcode);
    this.a1s.push(primitiveIndex);
    this.a2s.push(numArgs);
    // Primitive calls: -numArgs + 1 (args consumed, result produced)
    this.currentStackDepth = this.currentStackDepth - numArgs + 1;
    if (this.currentStackDepth > this.maxStackDepth) {
      this.maxStackDepth = this.currentStackDepth;
    }
  }

  emitCall(opcode: number, numArgs: number): void {
    this.ops.push(opcode);
    this.a1s.push(numArgs);
    this.a2s.push(0);
    // User calls: -(numArgs + 1) + 1 = -numArgs (function + args consumed, result produced)
    this.currentStackDepth = this.currentStackDepth - numArgs;
    if (this.currentStackDepth > this.maxStackDepth) {
      this.maxStackDepth = this.currentStackDepth;
    }
  }

  private updateStackDepth(opcode: number): void {
    this.currentStackDepth += STACK_EFFECTS[opcode];
    if (this.currentStackDepth > this.maxStackDepth) {
      this.maxStackDepth = this.currentStackDepth;
    }
  }

  /** Called by compiler when a new symbol slot is allocated. */
  noteSymbolUsed(): void {
    this.symbolCount++;
  }

  /**
   * Resolve labels, patch jump offsets, and produce an immutable SVMLIR.
   * Non-destructive: works on a copy of data, so the builder can be reused.
   * @param indexMap Optional map of old->new function indices for NEWC remapping.
   */
  build(indexMap?: Map<number, number>): SVMLIR {
    const n = this.ops.length;
    const opcodes = new Int32Array(n);
    const arg1s = new Float64Array(n);
    const arg2s = new Int32Array(n);

    for (let i = 0; i < n; i++) {
      opcodes[i] = this.ops[i];
      arg1s[i] = this.a1s[i];
      arg2s[i] = this.a2s[i];
    }

    // Patch jump offsets
    for (const { instrIndex, labelId } of this.fixups) {
      const targetIndex = this.labelPositions[labelId];
      if (targetIndex === undefined) {
        throw new SVMLCompilerError(`Undefined label ID: ${labelId}`);
      }
      arg1s[instrIndex] = targetIndex - instrIndex;
    }

    // Remap NEWC function indices when assembling into a new program
    if (indexMap) {
      for (let i = 0; i < n; i++) {
        if (
          opcodes[i] === OpCodes.NEWC ||
          opcodes[i] === OpCodes.NEWCP ||
          opcodes[i] === OpCodes.NEWCV
        ) {
          const oldIndex = arg1s[i];
          arg1s[i] = indexMap.get(oldIndex) ?? oldIndex;
        }
      }
    }

    return new SVMLIR(
      opcodes,
      arg1s,
      arg2s,
      this.strings.slice(), // copy for builder reuse
      this.maxStackDepth,
      this.symbolCount,
      this.numArgs,
    );
  }
}

// Pre-computed stack effects indexed by opcode for O(1) lookup
const STACK_EFFECTS = new Int16Array(OPCODE_MAX + 1);
(() => {
  // Load constant instructions (+1 to stack)
  STACK_EFFECTS[OpCodes.LDCI] = 1;
  STACK_EFFECTS[OpCodes.LGCI] = 1;
  STACK_EFFECTS[OpCodes.LDCF32] = 1;
  STACK_EFFECTS[OpCodes.LGCF32] = 1;
  STACK_EFFECTS[OpCodes.LDCF64] = 1;
  STACK_EFFECTS[OpCodes.LGCF64] = 1;
  STACK_EFFECTS[OpCodes.LDCB0] = 1;
  STACK_EFFECTS[OpCodes.LDCB1] = 1;
  STACK_EFFECTS[OpCodes.LGCB0] = 1;
  STACK_EFFECTS[OpCodes.LGCB1] = 1;
  STACK_EFFECTS[OpCodes.LGCU] = 1;
  STACK_EFFECTS[OpCodes.LGCN] = 1;
  STACK_EFFECTS[OpCodes.LGCS] = 1;

  // Pop instructions (-1 from stack)
  STACK_EFFECTS[OpCodes.POPG] = -1;
  STACK_EFFECTS[OpCodes.POPB] = -1;
  STACK_EFFECTS[OpCodes.POPF] = -1;

  // Binary arithmetic operations (-1, takes 2 operands, produces 1)
  STACK_EFFECTS[OpCodes.ADDG] = -1;
  STACK_EFFECTS[OpCodes.ADDF] = -1;
  STACK_EFFECTS[OpCodes.SUBG] = -1;
  STACK_EFFECTS[OpCodes.SUBF] = -1;
  STACK_EFFECTS[OpCodes.MULG] = -1;
  STACK_EFFECTS[OpCodes.MULF] = -1;
  STACK_EFFECTS[OpCodes.DIVG] = -1;
  STACK_EFFECTS[OpCodes.DIVF] = -1;
  STACK_EFFECTS[OpCodes.MODG] = -1;
  STACK_EFFECTS[OpCodes.MODF] = -1;
  STACK_EFFECTS[OpCodes.FLOORDIVG] = -1;
  STACK_EFFECTS[OpCodes.FLOORDIVF] = -1;

  // Comparison operations (-1, takes 2 operands, produces 1)
  STACK_EFFECTS[OpCodes.LTG] = -1;
  STACK_EFFECTS[OpCodes.LTF] = -1;
  STACK_EFFECTS[OpCodes.GTG] = -1;
  STACK_EFFECTS[OpCodes.GTF] = -1;
  STACK_EFFECTS[OpCodes.LEG] = -1;
  STACK_EFFECTS[OpCodes.LEF] = -1;
  STACK_EFFECTS[OpCodes.GEG] = -1;
  STACK_EFFECTS[OpCodes.GEF] = -1;
  STACK_EFFECTS[OpCodes.EQG] = -1;
  STACK_EFFECTS[OpCodes.EQF] = -1;
  STACK_EFFECTS[OpCodes.EQB] = -1;
  STACK_EFFECTS[OpCodes.NEQG] = -1;
  STACK_EFFECTS[OpCodes.NEQF] = -1;
  STACK_EFFECTS[OpCodes.NEQB] = -1;

  // Unary operations (0, takes 1 operand, produces 1)
  STACK_EFFECTS[OpCodes.NOTG] = 0;
  STACK_EFFECTS[OpCodes.NOTB] = 0;
  STACK_EFFECTS[OpCodes.NEGG] = 0;
  STACK_EFFECTS[OpCodes.NEGF] = 0;

  // Load variable instructions (+1 to stack)
  STACK_EFFECTS[OpCodes.LDLG] = 1;
  STACK_EFFECTS[OpCodes.LDLF] = 1;
  STACK_EFFECTS[OpCodes.LDLB] = 1;
  STACK_EFFECTS[OpCodes.LDPG] = 1;
  STACK_EFFECTS[OpCodes.LDPF] = 1;
  STACK_EFFECTS[OpCodes.LDPB] = 1;

  // Store variable instructions (-1 from stack)
  STACK_EFFECTS[OpCodes.STLG] = -1;
  STACK_EFFECTS[OpCodes.STLF] = -1;
  STACK_EFFECTS[OpCodes.STLB] = -1;
  STACK_EFFECTS[OpCodes.STPG] = -1;
  STACK_EFFECTS[OpCodes.STPF] = -1;
  STACK_EFFECTS[OpCodes.STPB] = -1;

  // Array operations
  STACK_EFFECTS[OpCodes.NEWA] = 0; // Takes size, produces array
  STACK_EFFECTS[OpCodes.LDAG] = -1;
  STACK_EFFECTS[OpCodes.LDAB] = -1;
  STACK_EFFECTS[OpCodes.LDAF] = -1;
  STACK_EFFECTS[OpCodes.STAG] = -3;
  STACK_EFFECTS[OpCodes.STAB] = -3;
  STACK_EFFECTS[OpCodes.STAF] = -3;

  // Function operations
  STACK_EFFECTS[OpCodes.NEWC] = 1;
  STACK_EFFECTS[OpCodes.NEWCP] = 1;
  STACK_EFFECTS[OpCodes.NEWCV] = 1;

  // Branch operations
  STACK_EFFECTS[OpCodes.BRT] = -1;
  STACK_EFFECTS[OpCodes.BRF] = -1;
  STACK_EFFECTS[OpCodes.BR] = 0;
  STACK_EFFECTS[OpCodes.JMP] = 0;

  // Return operations
  STACK_EFFECTS[OpCodes.RETG] = -1;
  STACK_EFFECTS[OpCodes.RETF] = -1;
  STACK_EFFECTS[OpCodes.RETB] = -1;
  STACK_EFFECTS[OpCodes.RETU] = 0;
  STACK_EFFECTS[OpCodes.RETN] = 0;

  // Utility operations
  STACK_EFFECTS[OpCodes.DUP] = 1;
  STACK_EFFECTS[OpCodes.NEWENV] = 0;
  STACK_EFFECTS[OpCodes.POPENV] = 0;

  // No-op
  STACK_EFFECTS[OpCodes.NOP] = 0;

  // Iterator opcodes
  STACK_EFFECTS[OpCodes.NEWITER] = 0; // pops iterable, pushes iterator (net 0)
  STACK_EFFECTS[OpCodes.FOR_ITER] = 1; // upper bound: pushes next value (exit path pops iter)
})();
