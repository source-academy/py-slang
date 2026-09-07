import { EV3Engine } from "../engines/ev3";
import OpCodes from "../engines/pvml/opcodes";
import { PVMLCompiler } from "../engines/pvml/pvml-compiler";
import { Resolver } from "../resolver";
import { parse } from "../parser/parser-adapter";
import ev3, { EV3_INTERNAL_FUNCTIONS } from "../stdlib/ev3";
import math from "../stdlib/math";
import misc from "../stdlib/misc";

async function runEV3(code: string) {
  const engine = new EV3Engine();
  return engine.execute(code.endsWith("\n") ? code : code + "\n");
}

/** Compiles `code` exactly the way EV3Engine does (same stdlib groups, `variant`, `useGlobalMap`,
 * `targetsPynter`, and `internalFunctions`) and returns the entry function's opcode/operand
 * arrays, for asserting the exact CALLV/CALLTV instructions a program compiles to. */
function compileEv3EntryInstructions(code: string) {
  const script = code.endsWith("\n") ? code : code + "\n";
  const ast = parse(script);
  const resolver = new Resolver("", ast, [], [misc, math, ev3]);
  const environments = resolver.resolveEnvironments(ast);
  const compiler = PVMLCompiler.fromProgram(
    ast,
    0,
    environments,
    false,
    true,
    EV3_INTERNAL_FUNCTIONS,
  );
  const program = compiler.compileProgram(ast);
  const entryFn = program.functions[program.entryPoint];
  return {
    opcodes: Array.from(entryFn.opcodes),
    arg1s: Array.from(entryFn.arg1s),
    arg2s: Array.from(entryFn.arg2s),
  };
}

describe("EV3 engine", () => {
  describe("parse and compile", () => {
    test("basic program compiles and returns PVML bytecode", async () => {
      const result = await runEV3("x = 1\ny = 2\nx + y\n");
      expect(result.status).toBe("finished");
      expect(result).toHaveProperty("output");
    });

    test("arithmetic program compiles successfully", async () => {
      const result = await runEV3("1 + 1\n");
      expect(result.status).toBe("finished");
    });

    test("for-loop program compiles successfully", async () => {
      const result = await runEV3("for i in range(3):\n    i\n");
      expect(result.status).toBe("finished");
    });

    test("function program compiles successfully", async () => {
      const result = await runEV3("def add(x, y):\n    return x + y\n\nadd(1, 2)\n");
      expect(result.status).toBe("finished");
    });

    test("returns a structured error for invalid syntax rather than throwing", async () => {
      const result = await runEV3("def invalid(:\n");
      expect(result.status).toBe("error");
      expect(result).toHaveProperty("error");
    });
  });

  // `ev3_*` names resolve during analysis (no NameError) because the `ev3` stdlib group is
  // registered with the resolver, and PVMLCompiler resolves each name against EV3_INTERNAL_FUNCTIONS
  // (stdlib/ev3.ts) to compile a call to CALLV/CALLTV — a "VM-internal function" call, distinct
  // from CALLP/CALLTP's native-primitive dispatch — carrying the device's own 0-based function
  // index as its `id` operand (arg1), matching pynter's `devices/ev3/src/ev3_functions.c`
  // `internals[]` C array position-for-position.
  describe("ev3_* device calls", () => {
    test("merely referencing an ev3_* name (not calling it) still compiles", async () => {
      const result = await runEV3("ev3_hello\n");
      expect(result.status).toBe("finished");
      expect(result).toHaveProperty("output");
    });

    test("ev3_pause(100) compiles to CALLV with device index 0 and 1 argument", () => {
      const { opcodes, arg1s, arg2s } = compileEv3EntryInstructions("ev3_pause(100)\n");
      const callIndex = opcodes.indexOf(OpCodes.CALLV);
      expect(callIndex).toBeGreaterThanOrEqual(0);
      expect(arg1s[callIndex]).toBe(0);
      expect(arg2s[callIndex]).toBe(1);
    });

    test("ev3_motorA() compiles to CALLV with device index 2 and 0 arguments", () => {
      const { opcodes, arg1s, arg2s } = compileEv3EntryInstructions("ev3_motorA()\n");
      const callIndex = opcodes.indexOf(OpCodes.CALLV);
      expect(callIndex).toBeGreaterThanOrEqual(0);
      expect(arg1s[callIndex]).toBe(2);
      expect(arg2s[callIndex]).toBe(0);
    });

    test("ev3_speak('hello') compiles to CALLV with device index 34 and 1 argument", () => {
      const { opcodes, arg1s, arg2s } = compileEv3EntryInstructions('ev3_speak("hello")\n');
      const callIndex = opcodes.indexOf(OpCodes.CALLV);
      expect(callIndex).toBeGreaterThanOrEqual(0);
      expect(arg1s[callIndex]).toBe(34);
      expect(arg2s[callIndex]).toBe(1);
    });

    test("multiple ev3_* calls in one program each resolve to their own correct device index", () => {
      const { opcodes, arg1s, arg2s } = compileEv3EntryInstructions(
        "ev3_pause(50)\nev3_motorA()\nev3_speak(\"hi\")\n",
      );
      const callIndices = opcodes
        .map((op, i) => (op === OpCodes.CALLV ? i : -1))
        .filter(i => i !== -1);
      expect(callIndices).toHaveLength(3);
      const [pauseIdx, motorAIdx, speakIdx] = callIndices;
      expect(arg1s[pauseIdx]).toBe(0);
      expect(arg2s[pauseIdx]).toBe(1);
      expect(arg1s[motorAIdx]).toBe(2);
      expect(arg2s[motorAIdx]).toBe(0);
      expect(arg1s[speakIdx]).toBe(34);
      expect(arg2s[speakIdx]).toBe(1);
    });

    test("an ev3_* call whose argument is itself an expression still resolves the correct device index", () => {
      const { opcodes, arg1s, arg2s } = compileEv3EntryInstructions("ev3_pause(50 + 50)\n");
      const callIndex = opcodes.indexOf(OpCodes.CALLV);
      expect(callIndex).toBeGreaterThanOrEqual(0);
      expect(arg1s[callIndex]).toBe(0);
      expect(arg2s[callIndex]).toBe(1);
      // The argument expression itself must still compile normally (ADDG) ahead of the call.
      expect(opcodes.slice(0, callIndex)).toContain(OpCodes.ADDG);
    });

    test("a program that doesn't reference any ev3_* name compiles with no CALLV/CALLTV at all", () => {
      const { opcodes } = compileEv3EntryInstructions("x = 1\ny = 2\nx + y\n");
      expect(opcodes).not.toContain(OpCodes.CALLV);
      expect(opcodes).not.toContain(OpCodes.CALLTV);
    });

    test("calling an unrecognised (non-ev3, non-primitive) name still fails to compile with a clear error", async () => {
      const result = await runEV3("totally_unknown_function()\n");
      expect(result.status).toBe("error");
      expect(result).toHaveProperty("error");
      if (result.status === "error") {
        expect(result.error).toMatch(/NameNotFoundError|not found/i);
      }
    });
  });
});
