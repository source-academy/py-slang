/**
 * Headless runner for the PVML/Pynter pathway.
 *
 * Compiles a SICPy program to PVML bytecode (same compiler as the
 * PyPvmlEvaluator/PyPvmlPynterEvaluator Conductor evaluators) and executes
 * it on a native Pynter `runner` binary (https://github.com/source-academy/pynter),
 * built separately via CMake. Pynter is a fork of Sinter kept as a separate
 * project so that Python-specific VM semantics don't risk destabilizing
 * Sinter, which remains the fallback engine for the Source curriculum.
 * Mirrors runCode()'s contract in runner.ts: returns concatenated print()
 * output, throws RunError on any failure.
 */

import { PYNTER_OPCODE_MAX } from "./engines/pvml/opcodes";
import { NativePynterError, runNativePynter } from "./engines/pvml/pynter/native-pynter";
import { assemble } from "./engines/pvml/pvml-assembler";
import { PVMLCompiler } from "./engines/pvml/pvml-compiler";
import { parse } from "./parser";
import { analyzeWithEnvironments } from "./resolver";
import { RunError } from "./runner";
import math from "./stdlib/math";
import misc from "./stdlib/misc";

export interface RunPvmlOptions {
  /** Path to a built native Pynter `runner` binary. */
  pynterPath: string;
}

export interface RunPvmlResult {
  /** Everything the program printed via print()/display(), concatenated. */
  output: string;
  /** The type of the program's final value, as reported by Pynter (e.g. "integer", "string"). */
  resultType: string;
  /** The program's final value, as reported by Pynter, still in its raw string form. */
  resultValue: string;
}

/**
 * Evaluate `code` as a SICPy program at the given `variant` by compiling it
 * to PVML and running it on a native Pynter binary. Returns both the
 * program's print() output and its final result value/type.
 *
 * Note: the PVML compiler currently only wires up the [misc, math] stdlib
 * groups (matching PyPvmlEvaluator/PyPvmlPynterEvaluator), so its chapter
 * coverage is narrower than the CSE pathway's — variants that rely on
 * linked lists, streams, or the parser library are not yet supported here.
 */
export async function runCodePvmlDetailed(
  code: string,
  variant: number,
  options: RunPvmlOptions,
): Promise<RunPvmlResult> {
  const { pynterPath } = options;
  const script = code.endsWith("\n") ? code : code + "\n";

  let ast;
  try {
    ast = parse(script);
  } catch (e: unknown) {
    throw new RunError("parse", String((e as { message?: string })?.message ?? e));
  }

  const { errors, environments } = analyzeWithEnvironments(ast, script, variant, [misc, math]);
  if (errors.length > 0) {
    throw new RunError("analysis", errors.map(e => e.message).join("\n"));
  }

  let binary: Uint8Array;
  try {
    const compiler = PVMLCompiler.fromProgram(ast, environments);
    const program = compiler.compileProgram(ast);
    binary = assemble(program, PYNTER_OPCODE_MAX);
  } catch (e: unknown) {
    throw new RunError("runtime", String((e as { message?: string })?.message ?? e));
  }

  let result;
  try {
    result = await runNativePynter(binary, pynterPath);
  } catch (e: unknown) {
    if (e instanceof NativePynterError) {
      throw new RunError("runtime", e.message);
    }
    throw e;
  }

  if (result.fault !== "no fault") {
    throw new RunError(
      "runtime",
      `Pynter fault: ${result.fault} (result type: ${result.resultType}, value: ${result.resultValue})`,
    );
  }

  return { output: result.output, resultType: result.resultType, resultValue: result.resultValue };
}

/**
 * Evaluate `code` as a SICPy program at the given `variant`, returning only
 * its print() output. See runCodePvmlDetailed() for the full result.
 */
export async function runCodePvml(
  code: string,
  variant: number,
  options: RunPvmlOptions,
): Promise<string> {
  const { output } = await runCodePvmlDetailed(code, variant, options);
  return output;
}
