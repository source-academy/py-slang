import { BasicEvaluator } from "@sourceacademy/conductor/runner";
import { PYNTER_OPCODE_MAX } from "../engines/pvml/opcodes";
import { assemble } from "../engines/pvml/pvml-assembler";
import { PVMLCompiler } from "../engines/pvml/pvml-compiler";
import initPynter, { PynterValue } from "../engines/pvml/pynter/pynter-wasm";
import { parse } from "../parser/parser-adapter";
import { analyzeWithEnvironments } from "../resolver";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import { EvaluatorError } from "./errors";

// siwasm_run (Pynter's devices/wasm/wasm/lib.c) printf's one of these two
// trailers to stdout on every run, as a debugging aid for the WASM demo,
// which has no other way to surface the return value:
//
//   - success: "Program exited with result type <type>: <value>" — pure
//     noise for us, since evaluateChunk already reads that value directly
//     off siwasm_run's return pointer (readReturnValue in pynter-wasm.ts).
//   - fault: "Program exited unsuccessfully: <fault name>" (e.g. "divide by
//     zero", "program called error()") — the ONLY place the fault name
//     appears. On a fault, wasm_result is left zeroed (type 0), so
//     readReturnValue's switch falls into its `default` case and throws a
//     generic "Unknown return type: 0" — the fault name would otherwise be
//     lost entirely rather than merely mislabeled as program output.
const RESULT_TRAILER_RE = /^Program exited with result type /;
const FAULT_TRAILER_RE = /^Program exited unsuccessfully: (.+)$/;

/** Fault name captured out of a matching FAULT_TRAILER_RE line, e.g. "divide by zero". */
export function matchPynterWasmFaultTrailer(text: string): string | undefined {
  return FAULT_TRAILER_RE.exec(text)?.[1];
}

export function isPynterWasmResultTrailer(text: string): boolean {
  return RESULT_TRAILER_RE.test(text);
}

function pynterValueToNative(value: PynterValue): unknown {
  switch (value.type) {
    case "int":
    case "float":
    case "bool":
    case "string":
      return value.value;
    case "NoneType":
    case "undefined":
      return undefined;
    default:
      throw new Error(`Unsupported Pynter value type: ${(value as { type: string }).type}`);
  }
}

/**
 * Compiles Python to PVML bytecode and runs it on Pynter, Source Academy's
 * native C bytecode VM, compiled to WebAssembly (see
 * src/engines/pvml/pynter/pynter-wasm.ts) — no CPython runtime, no
 * TypeScript interpreter loop.
 *
 * Unlike PyPvmlEvaluator/PyCseEvaluator, this evaluator does not persist a
 * global environment across evaluateChunk() calls: each chunk is compiled
 * and run as its own self-contained program, so a name bound in one chunk is
 * not visible in the next. REPL-style incremental development is not
 * supported yet — only single-shot "run this whole program" usage.
 */
export class PyPvmlPynterEvaluator extends BasicEvaluator {
  private pynter: Awaited<ReturnType<typeof initPynter>> | null = null;
  // Set by the print callback below when the current run's fault trailer
  // goes by; read (and reset) by the catch block once runBinary rejects.
  private lastFault: string | undefined;

  async evaluateChunk(chunk: string): Promise<void> {
    try {
      const script = chunk + "\n";
      const ast = parse(script);
      // Pynter's target is Python (SICPy) §3 specifically (see pynter/README.md).
      const { errors, environments } = analyzeWithEnvironments(ast, script, 3, [misc, math]);
      if (errors.length > 0) {
        throw errors[0];
      }
      const compiler = PVMLCompiler.fromProgram(ast, 3, environments, false, true);
      const program = compiler.compileProgram(ast);
      const binary = assemble(program, PYNTER_OPCODE_MAX);

      if (!this.pynter) {
        this.pynter = await initPynter({
          print: (text: string) => {
            const fault = matchPynterWasmFaultTrailer(text);
            if (fault !== undefined) {
              this.lastFault = fault;
              return;
            }
            if (isPynterWasmResultTrailer(text)) return;
            this.conductor.sendOutput(text);
          },
        });
      }
      this.lastFault = undefined;
      const result = this.pynter.runBinary(binary);
      this.conductor.sendResult(pynterValueToNative(result));
    } catch (e) {
      const error = this.lastFault !== undefined ? new Error(`Pynter fault: ${this.lastFault}`) : e;
      this.conductor.sendError(new EvaluatorError(error));
    }
  }
}
