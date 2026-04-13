import { OpCodes } from "./opcodes";
import { SVMLProgram } from "./types";

const OPCODES_STR = {
  [OpCodes.NOP]: "NOP   ",
  [OpCodes.LDCI]: "LDCI  ",
  [OpCodes.LGCI]: "LGCI  ",
  [OpCodes.LDCF32]: "LDCF32",
  [OpCodes.LGCF32]: "LGCF32",
  [OpCodes.LDCF64]: "LDCF64",
  [OpCodes.LGCF64]: "LGCF64",
  [OpCodes.LDCB0]: "LDCB0 ",
  [OpCodes.LDCB1]: "LDCB1 ",
  [OpCodes.LGCB0]: "LGCB0 ",
  [OpCodes.LGCB1]: "LGCB1 ",
  [OpCodes.LGCU]: "LGCU  ",
  [OpCodes.LGCN]: "LGCN  ",
  [OpCodes.LGCS]: "LGCS  ",
  [OpCodes.POPG]: "POPG  ",
  [OpCodes.POPB]: "POPB  ",
  [OpCodes.POPF]: "POPF  ",
  [OpCodes.ADDG]: "ADDG  ",
  [OpCodes.ADDF]: "ADDF  ",
  [OpCodes.SUBG]: "SUBG  ",
  [OpCodes.SUBF]: "SUBF  ",
  [OpCodes.MULG]: "MULG  ",
  [OpCodes.MULF]: "MULF  ",
  [OpCodes.DIVG]: "DIVG  ",
  [OpCodes.DIVF]: "DIVF  ",
  [OpCodes.MODG]: "MODG  ",
  [OpCodes.MODF]: "MODF  ",
  [OpCodes.NEGG]: "NEGG  ",
  [OpCodes.NEGF]: "NEGF  ",
  [OpCodes.NOTG]: "NOTG  ",
  [OpCodes.NOTB]: "NOTB  ",
  [OpCodes.LTG]: "LTG   ",
  [OpCodes.LTF]: "LTF   ",
  [OpCodes.GTG]: "GTG   ",
  [OpCodes.GTF]: "GTF   ",
  [OpCodes.LEG]: "LEG   ",
  [OpCodes.LEF]: "LEF   ",
  [OpCodes.GEG]: "GEG   ",
  [OpCodes.GEF]: "GEF   ",
  [OpCodes.EQG]: "EQG   ",
  [OpCodes.EQF]: "EQF   ",
  [OpCodes.EQB]: "EQB   ",
  [OpCodes.NEQG]: "NEQG  ",
  [OpCodes.NEQF]: "NEQF  ",
  [OpCodes.NEQB]: "NEQB  ",
  [OpCodes.NEWC]: "NEWC  ",
  [OpCodes.NEWA]: "NEWA  ",
  [OpCodes.LDLG]: "LDLG  ",
  [OpCodes.LDLF]: "LDLF  ",
  [OpCodes.LDLB]: "LDLB  ",
  [OpCodes.STLG]: "STLG  ",
  [OpCodes.STLB]: "STLB  ",
  [OpCodes.STLF]: "STLF  ",
  [OpCodes.LDPG]: "LDPG  ",
  [OpCodes.LDPF]: "LDPF  ",
  [OpCodes.LDPB]: "LDPB  ",
  [OpCodes.STPG]: "STPG  ",
  [OpCodes.STPB]: "STPB  ",
  [OpCodes.STPF]: "STPF  ",
  [OpCodes.LDAG]: "LDAG  ",
  [OpCodes.LDAB]: "LDAB  ",
  [OpCodes.LDAF]: "LDAF  ",
  [OpCodes.STAG]: "STAG  ",
  [OpCodes.STAB]: "STAB  ",
  [OpCodes.STAF]: "STAF  ",
  [OpCodes.BRT]: "BRT   ",
  [OpCodes.BRF]: "BRF   ",
  [OpCodes.BR]: "BR    ",
  [OpCodes.JMP]: "JMP   ",
  [OpCodes.CALL]: "CALL  ",
  [OpCodes.CALLT]: "CALLT ",
  [OpCodes.CALLP]: "CALLP ",
  [OpCodes.CALLTP]: "CALLTP",
  [OpCodes.CALLV]: "CALLV ",
  [OpCodes.CALLTV]: "CALLTV",
  [OpCodes.RETG]: "RETG  ",
  [OpCodes.RETF]: "RETF  ",
  [OpCodes.RETB]: "RETB  ",
  [OpCodes.RETU]: "RETU  ",
  [OpCodes.RETN]: "RETN  ",
  [OpCodes.DUP]: "DUP   ",
  [OpCodes.NEWENV]: "NEWENV",
  [OpCodes.POPENV]: "POPENV",
  [OpCodes.NEWCP]: "NEWCP ",
  [OpCodes.NEWCV]: "NEWCV ",
};

// get name of opcode for debugging
export function getName(op: number) {
  return OPCODES_STR[op as keyof typeof OPCODES_STR] ?? OpCodes[op] ?? `UNKNOWN(${op})`;
}

// pretty-print the program
export function stringifyProgram(P: SVMLProgram) {
  let programStr = "";
  programStr += "Entry function: " + P.entryPoint + "\n";
  for (let i = 0; i < P.functions.length; i++) {
    const f = P.functions[i];
    let s =
      "#" +
      i +
      ":\nStack Size: " +
      f.stackSize +
      "\nEnv Size: " +
      f.envSize +
      "\nNum Args: " +
      f.numArgs +
      "\n";
    const instructions = f.toInstructions();
    for (let j = 0; j < instructions.length; j++) {
      s += j;
      const ins = instructions[j];
      s += ": " + getName(ins.opcode);
      s += " " + (ins.arg1 ?? " ");
      s += " " + (ins.arg2 ?? " ");
      s += "\n";
    }
    programStr += s + "\n";
  }
  return programStr;
}
