import { PYNTER_OPCODE_MAX } from "../pvml/opcodes";
import { assemble } from "../pvml/pvml-assembler";
import { PVMLCompiler } from "../pvml/pvml-compiler";
import { parse } from "../../parser/parser-adapter";
import { Resolver } from "../../resolver";
import ev3, { EV3_INTERNAL_FUNCTIONS } from "../../stdlib/ev3";
import math from "../../stdlib/math";
import misc from "../../stdlib/misc";
import type { EV3ExecutionResult } from "./types";

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0xffff;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunkSize) as unknown as number[],
    );
  }
  return btoa(binary);
}

/**
 * Compiles a robot control program to PVML bytecode for transmission to the physical EV3 (via
 * `Ev3ExecutionPlugin` -> sling -> the on-device VM), rather than interpreting it locally —
 * unlike `PyPvmlEvaluator`, which runs compiled PVML on `PVMLInterpreter` right where it's
 * compiled, nothing here ever executes the program.
 *
 * Registering the `ev3` stdlib group makes `ev3_*` names resolve during analysis (no NameError),
 * and passing `EV3_INTERNAL_FUNCTIONS` (stdlib/ev3.ts) as PVMLCompiler's `internalFunctions` table
 * makes a reference to one compile to a CALLV/CALLTV (call) or NEWCV (value) device-function
 * instruction, resolved by name to the same 0-based index pynter's own on-device
 * `sivmfn_vminternals` dispatch table uses for that function.
 */
export class EV3Engine {
  // Not `async`: compilation is entirely synchronous today. The signature stays
  // Promise-returning to match `Ev3ExecutionPlugin`'s call site and to leave room for this to
  // become genuinely asynchronous later without changing every caller.
  execute(code: string): Promise<EV3ExecutionResult> {
    try {
      const script = code + "\n";
      const ast = parse(script);

      const resolver = new Resolver("", ast, [], [misc, math, ev3]);
      const environments = resolver.resolveEnvironments(ast);
      if (resolver.errors.length > 0) {
        throw resolver.errors[0];
      }

      // targetsPynter=true: this compiles to a fixed-width binary shipped to a physical device,
      // so `int` literals must use LGCI/LGCF64 (int32-range or float), never LGCBI's
      // arbitrary-precision bigint pool — see PVMLCompiler's `targetsPynter` doc comment.
      const compiler = PVMLCompiler.fromProgram(
        ast,
        0,
        environments,
        false,
        true,
        EV3_INTERNAL_FUNCTIONS,
      );
      const program = compiler.compileProgram(ast);
      const binary = assemble(program, PYNTER_OPCODE_MAX);

      return Promise.resolve({ status: "finished", output: uint8ArrayToBase64(binary) });
    } catch (err) {
      return Promise.resolve({
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
