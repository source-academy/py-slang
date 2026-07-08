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
import { RunError, VARIANT_GROUPS } from "./runner";
import type { Group } from "./stdlib/utils";

export interface RunPvmlOptions {
  /** Path to a built native Pynter `runner` binary. */
  pynterPath: string;
  /**
   * Stdlib groups to load, overriding the VARIANT_GROUPS[variant] default.
   * Needed for the handful of test suites that exercise a non-canonical
   * combination for a given variant (e.g. stream tests run at variant 2 with
   * the `stream`/`pairmutator` groups added on top).
   */
  groups?: Group[];
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
 * Stdlib groups default to VARIANT_GROUPS[variant] (see runner.ts), matching
 * the CSE pathway's chapter coverage. A group's prelude (SICPy source, e.g.
 * linked-list.prelude.ts's `equal`/`map`/`reverse`/...) is prepended to
 * `code` and compiled + run as a single PVML program: unlike the CSE
 * machine, which runs the prelude once into a shared, mutable environment
 * ahead of the main script, each native Pynter invocation is a fresh
 * process with no persistent environment to carry prelude bindings across —
 * so prelude and script must be one compilation unit for the script to see
 * the prelude's functions at all.
 */
export async function runCodePvmlDetailed(
  code: string,
  variant: number,
  options: RunPvmlOptions,
): Promise<RunPvmlResult> {
  // Pynter's target is Python (SICPy) §3 specifically (see pynter/README.md) —
  // it implements that chapter's semantics unconditionally, with no runtime
  // notion of "chapter" to gate narrower/wider rules for §1/§2/§4. Reject
  // anything else here rather than silently running it with the wrong rules.
  if (variant !== 3) {
    throw new RunError("parse", `Pynter only supports Python §3; got variant ${variant}.`);
  }

  const { pynterPath, groups = VARIANT_GROUPS[variant] } = options;
  if (!groups) throw new RunError("parse", `Invalid variant: ${variant}. Expected 1–4.`);

  const script = code.endsWith("\n") ? code : code + "\n";
  const preludeText = groups
    .map(g => g.prelude ?? "")
    .filter(p => p.trim())
    .join("\n");
  const fullSource = preludeText ? `${preludeText}\n${script}` : script;

  let ast;
  try {
    ast = parse(fullSource);
  } catch (e: unknown) {
    throw new RunError("parse", String((e as { message?: string })?.message ?? e));
  }

  const { errors, environments } = analyzeWithEnvironments(ast, fullSource, variant, groups);
  if (errors.length > 0) {
    throw new RunError("analysis", errors.map(e => e.message).join("\n"));
  }

  let binary: Uint8Array;
  try {
    const compiler = PVMLCompiler.fromProgram(ast, variant, environments, false, true);
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
