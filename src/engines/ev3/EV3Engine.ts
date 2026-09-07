import { PYNTER_OPCODE_MAX } from "../pvml/opcodes";
import { assemble } from "../pvml/pvml-assembler";
import { PVMLCompiler } from "../pvml/pvml-compiler";
import { parse } from "../../parser/parser-adapter";
import { Resolver } from "../../resolver";
import ev3 from "../../stdlib/ev3";
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
 * Registering the `ev3` stdlib group makes `ev3_*` names resolve during analysis (no NameError)
 * but does NOT yet make them compile successfully — see `stdlib/ev3.ts`'s doc comment for why
 * (PVMLCompiler has no device-call annotation/CALLV emission today). A program that avoids the
 * EV3 API entirely still compiles and assembles correctly through this engine; one that so much
 * as *references* an `ev3_*` name (called or not) fails with a clean `{status: 'error', ...}`
 * from the compiler's own "Primitive function ... not implemented" check, rather than producing
 * silently-wrong bytecode.
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
      const compiler = PVMLCompiler.fromProgram(ast, 0, environments, false, true);
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
