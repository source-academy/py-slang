/**
 * Headless runner for the SVML/Pynter pathway.
 *
 * Compiles a SICPy program to SVML bytecode (same compiler as the
 * PySvmlEvaluator/PySvmlSinterEvaluator Conductor evaluators) and executes
 * it on a native Pynter `runner` binary (https://github.com/source-academy/pynter),
 * built separately via CMake. Pynter is a fork of Sinter kept as a separate
 * project so that Python-specific VM semantics don't risk destabilizing
 * Sinter, which remains the fallback engine for the Source curriculum.
 * Mirrors runCode()'s contract in runner.ts: returns concatenated print()
 * output, throws RunError on any failure.
 */

import { SINTER_OPCODE_MAX } from "./engines/svml/opcodes";
import { NativePynterError, runNativePynter } from "./engines/svml/pynter/native-pynter";
import { assemble } from "./engines/svml/svml-assembler";
import { SVMLCompiler } from "./engines/svml/svml-compiler";
import { parse } from "./parser";
import { analyzeWithEnvironments } from "./resolver";
import { RunError } from "./runner";
import math from "./stdlib/math";
import misc from "./stdlib/misc";

export interface RunSvmlOptions {
  /** Path to a built native Pynter `runner` binary. */
  pynterPath: string;
}

export interface RunSvmlResult {
  /** Everything the program printed via print()/display(), concatenated. */
  output: string;
  /** The type of the program's final value, as reported by Pynter (e.g. "integer", "string"). */
  resultType: string;
  /** The program's final value, as reported by Pynter, still in its raw string form. */
  resultValue: string;
}

/**
 * Evaluate `code` as a SICPy program at the given `variant` by compiling it
 * to SVML and running it on a native Pynter binary. Returns both the
 * program's print() output and its final result value/type.
 *
 * Note: the SVML compiler currently only wires up the [misc, math] stdlib
 * groups (matching PySvmlEvaluator/PySvmlSinterEvaluator), so its chapter
 * coverage is narrower than the CSE pathway's — variants that rely on
 * linked lists, streams, or the parser library are not yet supported here.
 */
export async function runCodeSvmlDetailed(
  code: string,
  variant: number,
  options: RunSvmlOptions,
): Promise<RunSvmlResult> {
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
    const compiler = SVMLCompiler.fromProgram(ast, environments);
    const program = compiler.compileProgram(ast);
    binary = assemble(program, SINTER_OPCODE_MAX);
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
 * its print() output. See runCodeSvmlDetailed() for the full result.
 */
export async function runCodeSvml(
  code: string,
  variant: number,
  options: RunSvmlOptions,
): Promise<string> {
  const { output } = await runCodeSvmlDetailed(code, variant, options);
  return output;
}
