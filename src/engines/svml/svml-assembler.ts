import Buffer from "../../utils/buffer";
import OpCodes, { getInstructionSize, OPCODE_MAX } from "./opcodes";
import { Instruction, SVMLProgram, SVMLIR } from "./types";

const SVM_MAGIC = 0x5005acad;
const MAJOR_VER = 0;
const MINOR_VER = 0;

let UTF8_ENCODER: TextEncoder | undefined;
let UTF8_DECODER: TextDecoder | undefined;

/**
 * A "hole" in an assembled function.
 */
interface Hole {
  offset: number;
  referent: ["string", string] | ["function", number];
}

/**
 * Intermediate (partially serialised) function.
 */
interface ImFunction {
  binary: Uint8Array;
  holes: Hole[];
  finalOffset: number | null;
}

function writeHeader(b: Buffer, entrypoint: number, constantCount: number) {
  b.cursor = 0;
  b.putU(32, SVM_MAGIC);
  b.putU(16, MAJOR_VER);
  b.putU(16, MINOR_VER);
  b.putU(32, entrypoint);
  b.putU(32, constantCount);
}

function writeStringConstant(b: Buffer, s: string) {
  if (UTF8_ENCODER === undefined) {
    UTF8_ENCODER = new TextEncoder();
  }
  const sBytes = UTF8_ENCODER.encode(s);

  b.align(4);
  b.putU(16, 1);
  b.putU(32, sBytes.byteLength + 1);
  b.putA(sBytes);
  b.putU(8, 0);
}

function serialiseFunction(f: SVMLIR): ImFunction {
  const code = f.toInstructions();
  const { stackSize, envSize, numArgs } = f;
  const holes: Hole[] = [];
  const b = new Buffer();

  b.putU(8, stackSize);
  b.putU(8, envSize);
  b.putU(8, numArgs);
  b.putU(8, 0); // padding

  const instrOffsets = code
    .map(i => getInstructionSize(i.opcode))
    .reduce((ss, s) => (ss.push(ss[ss.length - 1] + s), ss), [0]);

  for (const [instr, index] of code.map((i1, i2) => [i1, i2] as [Instruction, number])) {
    if (instr.opcode < 0 || instr.opcode > OPCODE_MAX) {
      throw new Error(`Invalid opcode ${instr.opcode.toString()}`);
    }
    const opcode: OpCodes = instr.opcode;
    b.putU(8, opcode);
    switch (opcode) {
      case OpCodes.LDCI:
      case OpCodes.LGCI:
        if (!Number.isInteger(instr.arg1 as number)) {
          throw new Error(
            `Non-integral operand to LDCI/LDGI: ${instr.arg1} (this is a compiler bug)`,
          );
        }
        b.putI(32, instr.arg1 as number);
        break;
      case OpCodes.LDCF32:
      case OpCodes.LGCF32:
        b.putF(32, instr.arg1 as number);
        break;
      case OpCodes.LDCF64:
      case OpCodes.LGCF64:
        b.putF(64, instr.arg1 as number);
        break;
      case OpCodes.LGCS:
        holes.push({
          offset: b.cursor,
          referent: ["string", instr.arg1 as string],
        });
        b.putU(32, 0);
        break;
      case OpCodes.NEWC:
        holes.push({
          offset: b.cursor,
          referent: ["function", instr.arg1 as number],
        });
        b.putU(32, 0);
        break;
      case OpCodes.LDLG:
      case OpCodes.LDLF:
      case OpCodes.LDLB:
      case OpCodes.STLG:
      case OpCodes.STLF:
      case OpCodes.STLB:
      case OpCodes.CALL:
      case OpCodes.CALLT:
      case OpCodes.NEWENV:
      case OpCodes.NEWCP:
      case OpCodes.NEWCV:
        b.putU(8, instr.arg1 as number);
        break;
      case OpCodes.LDPG:
      case OpCodes.LDPF:
      case OpCodes.LDPB:
      case OpCodes.STPG:
      case OpCodes.STPF:
      case OpCodes.STPB:
      case OpCodes.CALLP:
      case OpCodes.CALLTP:
      case OpCodes.CALLV:
      case OpCodes.CALLTV:
        b.putU(8, instr.arg1 as number);
        b.putU(8, instr.arg2 as number);
        break;
      case OpCodes.BRF:
      case OpCodes.BRT:
      case OpCodes.BR:
        const offset = instrOffsets[index + (instr.arg1 as number)] - instrOffsets[index + 1];
        b.putI(32, offset);
        break;
      case OpCodes.JMP:
        throw new Error("JMP assembling not implemented");
    }
  }

  const binary = b.asArray();
  if (binary.byteLength - 4 !== instrOffsets[instrOffsets.length - 1]) {
    throw new Error(
      `Assembler bug: calculated function length ${
        instrOffsets[instrOffsets.length - 1]
      } is different from actual length ${binary.byteLength - 4}`,
    );
  }

  return {
    binary: b.asArray(),
    holes,
    finalOffset: null,
  };
}

export function assemble(p: SVMLProgram): Uint8Array {
  const entrypointIndex = p.entryPoint;
  const jsonFns = p.functions;

  // serialise all the functions
  const imFns = jsonFns.map(fn => serialiseFunction(fn));

  // collect all string constants
  const uniqueStrings = [
    ...new Set(
      ([] as string[]).concat(
        ...imFns.map(fn =>
          fn.holes
            .filter(hole => hole.referent[0] === "string")
            .map(hole => hole.referent[1] as string),
        ),
      ),
    ),
  ];

  const bin = new Buffer();
  // skip header for now
  bin.cursor = 0x10;

  // write all the strings, and store their positions
  const stringMap: Map<string, number> = new Map();
  for (const str of uniqueStrings) {
    bin.align(4);
    stringMap.set(str, bin.cursor);
    writeStringConstant(bin, str);
  }

  // layout the functions, but don't actually write them yet
  const fnStartOffset = bin.cursor;
  for (const fn of imFns) {
    bin.align(4);
    fn.finalOffset = bin.cursor;
    bin.cursor += fn.binary.byteLength;
  }

  // now fill in the holes
  for (const fn of imFns) {
    const view = new DataView(fn.binary.buffer);
    for (const hole of fn.holes) {
      let offset;
      if (hole.referent[0] === "string") {
        offset = stringMap.get(hole.referent[1]);
      } else {
        offset = imFns[hole.referent[1]].finalOffset;
      }
      if (offset === undefined || offset === null) {
        throw new Error(`Assembler bug: missing string/function: ${JSON.stringify(hole)}`);
      }
      view.setUint32(hole.offset, offset, true);
    }
  }

  // now we write the functions
  bin.cursor = fnStartOffset;
  for (const fn of imFns) {
    bin.align(4);
    if (bin.cursor !== fn.finalOffset) {
      throw new Error("Assembler bug: function offset changed");
    }
    bin.putA(fn.binary);
  }

  bin.cursor = 0;
  writeHeader(bin, imFns[entrypointIndex].finalOffset!, uniqueStrings.length);

  return bin.asArray();
}

export function disassemble(p: Uint8Array): SVMLProgram {
  const view = new DataView(p.buffer, p.byteOffset, p.byteLength);

  const align4 = (n: number) => (n + 3) & ~3;

  const magic = view.getUint32(0, true);
  if (magic !== SVM_MAGIC) {
    throw new Error("Invalid SVM binary: bad magic number");
  }

  const major = view.getUint16(4, true);
  const minor = view.getUint16(6, true);
  if (major !== MAJOR_VER || minor !== MINOR_VER) {
    throw new Error(`Unsupported SVML version ${major}.${minor}`);
  }

  const entrypointOffset = view.getUint32(8, true);
  const constantCount = view.getUint32(12, true);

  if (UTF8_DECODER === undefined) {
    UTF8_DECODER = new TextDecoder();
  }

  let cursor = 0x10;
  const stringByOffset: Map<number, string> = new Map();

  for (let i = 0; i < constantCount; i++) {
    cursor = align4(cursor);
    if (cursor + 6 > p.byteLength) {
      throw new Error("Truncated SVML binary while reading constants");
    }
    const strOffset = cursor;
    const tag = view.getUint16(cursor, true);
    cursor += 2;
    if (tag !== 1) {
      throw new Error(`Unsupported constant tag ${tag}`);
    }
    const size = view.getUint32(cursor, true);
    cursor += 4;
    if (size === 0 || cursor + size > p.byteLength) {
      throw new Error("Truncated SVML binary while reading string constant");
    }
    const raw = new Uint8Array(p.buffer, p.byteOffset + cursor, size);
    const strBytes = raw.subarray(0, size - 1);
    const value = UTF8_DECODER.decode(strBytes);
    stringByOffset.set(strOffset, value);
    cursor += size;
  }

  cursor = align4(cursor);
  const functionsStart = cursor;

  if (functionsStart >= p.byteLength) {
    throw new Error("Malformed SVML binary: no function section");
  }

  // First pass: collect all function start offsets
  // Start with entrypoint and any 4-byte aligned offsets referenced by NEWC
  const functionOffsetSet = new Set<number>([entrypointOffset]);

  // Scan the binary for NEWC instructions to find function references
  let scanCursor = functionsStart;
  while (scanCursor < p.byteLength) {
    const opcode = view.getUint8(scanCursor);
    if (opcode === OpCodes.NEWC && scanCursor + 5 <= p.byteLength) {
      const targetOffset = view.getUint32(scanCursor + 1, true);
      if (targetOffset >= functionsStart && targetOffset < p.byteLength) {
        functionOffsetSet.add(targetOffset);
      }
    }
    scanCursor++;
  }

  const functionOffsets = Array.from(functionOffsetSet).sort((a, b) => a - b);

  // Intermediate raw function data (mutable until all fixups are applied)
  interface RawFunction {
    stackSize: number;
    envSize: number;
    numArgs: number;
    instructions: Instruction[];
  }

  // Second pass: parse each function into mutable raw data
  const rawFunctions: RawFunction[] = [];
  const offsetToIndex = new Map<number, number>();
  const closureFixups: Array<{ fnIndex: number; instrIndex: number; targetOffset: number }> = [];

  for (let fnIdx = 0; fnIdx < functionOffsets.length; fnIdx++) {
    const fnStart = functionOffsets[fnIdx];
    const fnEnd = fnIdx + 1 < functionOffsets.length ? functionOffsets[fnIdx + 1] : p.byteLength;

    offsetToIndex.set(fnStart, fnIdx);

    if (fnStart + 4 > fnEnd) {
      throw new Error(`Function at offset 0x${fnStart.toString(16)} is too small`);
    }

    const stackSize = view.getUint8(fnStart);
    const envSize = view.getUint8(fnStart + 1);
    const numArgs = view.getUint8(fnStart + 2);
    const padding = view.getUint8(fnStart + 3);

    if (padding !== 0) {
      throw new Error(`Invalid function padding at offset 0x${fnStart.toString(16)}`);
    }

    cursor = fnStart + 4;

    const instructions: Instruction[] = [];
    const instructionSizes: number[] = [];
    const branchFixups: Array<{ index: number; byteOffset: number }> = [];
    const newcFixups: Array<{ instrIndex: number; targetOffset: number }> = [];

    // Parse instructions until we reach the next function or end
    while (cursor < fnEnd) {
      const opcodeStart = cursor;
      const opcode = view.getUint8(cursor);

      if (opcode > OPCODE_MAX) {
        throw new Error(`Invalid opcode ${opcode} at offset 0x${cursor.toString(16)}`);
      }

      cursor += 1;

      let arg1: number | string | undefined;
      let arg2: number | undefined;

      switch (opcode) {
        case OpCodes.LDCI:
        case OpCodes.LGCI:
          if (cursor + 4 > p.byteLength) {
            throw new Error("Truncated instruction");
          }
          arg1 = view.getInt32(cursor, true);
          cursor += 4;
          break;
        case OpCodes.LDCF32:
        case OpCodes.LGCF32:
          if (cursor + 4 > p.byteLength) {
            throw new Error("Truncated instruction");
          }
          arg1 = view.getFloat32(cursor, true);
          cursor += 4;
          break;
        case OpCodes.LDCF64:
        case OpCodes.LGCF64:
          if (cursor + 8 > p.byteLength) {
            throw new Error("Truncated instruction");
          }
          arg1 = view.getFloat64(cursor, true);
          cursor += 8;
          break;
        case OpCodes.LGCS: {
          if (cursor + 4 > p.byteLength) {
            throw new Error("Truncated instruction");
          }
          const strOffset = view.getUint32(cursor, true);
          cursor += 4;
          const str = stringByOffset.get(strOffset);
          if (str === undefined) {
            throw new Error(`Unknown string constant at offset 0x${strOffset.toString(16)}`);
          }
          arg1 = str;
          break;
        }
        case OpCodes.NEWC: {
          if (cursor + 4 > p.byteLength) {
            throw new Error("Truncated instruction");
          }
          const targetOffset = view.getUint32(cursor, true);
          cursor += 4;
          arg1 = targetOffset;
          newcFixups.push({ instrIndex: instructions.length, targetOffset });
          break;
        }
        case OpCodes.LDLG:
        case OpCodes.LDLF:
        case OpCodes.LDLB:
        case OpCodes.STLG:
        case OpCodes.STLF:
        case OpCodes.STLB:
        case OpCodes.CALL:
        case OpCodes.CALLT:
        case OpCodes.NEWENV:
        case OpCodes.NEWCP:
        case OpCodes.NEWCV:
          if (cursor + 1 > p.byteLength) {
            throw new Error("Truncated instruction");
          }
          arg1 = view.getUint8(cursor);
          cursor += 1;
          break;
        case OpCodes.LDPG:
        case OpCodes.LDPF:
        case OpCodes.LDPB:
        case OpCodes.STPG:
        case OpCodes.STPF:
        case OpCodes.STPB:
        case OpCodes.CALLP:
        case OpCodes.CALLTP:
        case OpCodes.CALLV:
        case OpCodes.CALLTV:
          if (cursor + 2 > p.byteLength) {
            throw new Error("Truncated instruction");
          }
          arg1 = view.getUint8(cursor);
          arg2 = view.getUint8(cursor + 1);
          cursor += 2;
          break;
        case OpCodes.BRF:
        case OpCodes.BRT:
        case OpCodes.BR: {
          if (cursor + 4 > p.byteLength) {
            throw new Error("Truncated instruction");
          }
          const rawOffset = view.getInt32(cursor, true);
          cursor += 4;
          arg1 = rawOffset;
          branchFixups.push({ index: instructions.length, byteOffset: rawOffset });
          break;
        }
        case OpCodes.JMP:
          throw new Error("JMP disassembly not implemented");
      }

      const instruction: Instruction = { opcode };
      if (arg1 !== undefined) {
        instruction.arg1 = arg1;
      }
      if (arg2 !== undefined) {
        instruction.arg2 = arg2;
      }
      instructions.push(instruction);
      instructionSizes.push(cursor - opcodeStart);
    }

    // Convert branch byte offsets to instruction indices
    const offsets: number[] = [0];
    for (const size of instructionSizes) {
      offsets.push(offsets[offsets.length - 1] + size);
    }

    for (const { index, byteOffset } of branchFixups) {
      const afterCurrent = offsets[index + 1];
      const targetByteOffset = afterCurrent + byteOffset;
      const targetIndex = offsets.indexOf(targetByteOffset);
      if (targetIndex === -1) {
        throw new Error(
          `Invalid branch target: afterCurrent=${afterCurrent}, byteOffset=${byteOffset}, targetByteOffset=${targetByteOffset}, offsets=[${offsets.join(",")}]`,
        );
      }
      instructions[index].arg1 = targetIndex - index;
    }

    rawFunctions.push({ stackSize, envSize, numArgs, instructions });

    for (const fixup of newcFixups) {
      closureFixups.push({
        fnIndex: fnIdx,
        instrIndex: fixup.instrIndex,
        targetOffset: fixup.targetOffset,
      });
    }
  }

  if (rawFunctions.length === 0) {
    throw new Error("SVML binary does not contain any functions");
  }

  const entrypointIndex = offsetToIndex.get(entrypointOffset);
  if (entrypointIndex === undefined) {
    throw new Error("Entrypoint function offset not found in binary");
  }

  // Apply closure fixups on mutable data before freezing into SVMLIR
  for (const { fnIndex, instrIndex, targetOffset } of closureFixups) {
    const targetIndex = offsetToIndex.get(targetOffset);
    if (targetIndex === undefined) {
      throw new Error(`Unknown function reference at offset 0x${targetOffset.toString(16)}`);
    }
    rawFunctions[fnIndex].instructions[instrIndex].arg1 = targetIndex;
  }

  // Now freeze into immutable SVMLIR instances
  const functions = rawFunctions.map(f => {
    const n = f.instructions.length;
    const opcodes = new Int32Array(n);
    const arg1s = new Float64Array(n);
    const arg2s = new Int32Array(n);
    const strings: string[] = [];

    for (let i = 0; i < n; i++) {
      opcodes[i] = f.instructions[i].opcode;
      const a1 = f.instructions[i].arg1;
      if (typeof a1 === "string") {
        arg1s[i] = strings.length;
        strings.push(a1);
      } else {
        arg1s[i] = (a1 as number) ?? 0;
      }
      arg2s[i] = (f.instructions[i].arg2 as number) ?? 0;
    }

    // symbolCount = envSize - numArgs (since envSize = symbolCount + numArgs)
    const symbolCount = f.envSize - f.numArgs;
    return new SVMLIR(opcodes, arg1s, arg2s, strings, f.stackSize, symbolCount, f.numArgs);
  });

  return new SVMLProgram(entrypointIndex, functions);
}
