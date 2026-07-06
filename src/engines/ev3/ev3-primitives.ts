import { PRIMITIVE_FUNCTIONS } from "../svml/builtins";
import { EV3_FUNCTIONS } from "../../stdlib/ev3";
import OpCodes from "../svml/opcodes";
import { SVMLProgram, SVMLIR } from "../svml/types";

export const EV3_DUMMY_OFFSET = 1000;

// Side-effect registration: run once, on import.
EV3_FUNCTIONS.forEach((name, i) => {
  PRIMITIVE_FUNCTIONS.set(name, EV3_DUMMY_OFFSET + i);
});

export function rewriteEv3PrimitiveCalls(program: SVMLProgram): SVMLProgram {
  const functions = program.functions.map(fn => {
    const opcodes = fn.opcodes.slice();
    const arg1s = fn.arg1s.slice();

    for (let i = 0; i < opcodes.length; i++) {
      if (opcodes[i] === OpCodes.CALLP && arg1s[i] >= EV3_DUMMY_OFFSET) {
        opcodes[i] = OpCodes.CALLV;
        arg1s[i] -= EV3_DUMMY_OFFSET;
      } else if (opcodes[i] === OpCodes.CALLTP && arg1s[i] >= EV3_DUMMY_OFFSET) {
        opcodes[i] = OpCodes.CALLTV;
        arg1s[i] -= EV3_DUMMY_OFFSET;
      }
    }

    return new SVMLIR(
      opcodes,
      arg1s,
      fn.arg2s,
      [...fn.strings],
      fn.stackSize,
      fn.envSize - fn.numArgs, // symbolCount
      fn.numArgs,
    );
  });

  return new SVMLProgram(program.entryPoint, [...functions]);
}