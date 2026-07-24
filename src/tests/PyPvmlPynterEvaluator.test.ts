import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import {
  isPynterWasmResultTrailer,
  matchPynterWasmFaultTrailer,
  PyPvmlPynterEvaluator,
} from "../conductor/PyPvmlPynterEvaluator";

/** Minimal IRunnerPlugin mock: PyPvmlPynterEvaluator only ever calls
 * sendResult/sendError/sendOutput on its `conductor`. */
function makeMockConductor() {
  const results: unknown[] = [];
  const errors: unknown[] = [];
  const outputs: string[] = [];
  const conductor = {
    sendResult: (r: unknown) => results.push(r),
    sendError: (e: unknown) => errors.push(e),
    sendOutput: (m: string) => outputs.push(m),
  } as unknown as IRunnerPlugin;
  return { conductor, results, errors, outputs };
}

// Pynter only actually runs as a compiled WASM binary, and Jest stubs the
// .wasm import out entirely (see src/tests/__mocks__/wasm.js) — Pynter's
// computational correctness is exercised elsewhere, against the native
// binary (native-pynter.test.ts, operator-conformance-pynter.test.ts). These
// tests can't check computed results; they check evaluateChunk's own
// behavior around compilation and WASM instantiation.
describe("PyPvmlPynterEvaluator", () => {
  test("a WASM instantiation failure reports via sendError rather than hanging forever", async () => {
    const { conductor, errors } = makeMockConductor();
    const evaluator = new PyPvmlPynterEvaluator(conductor);

    await evaluator.evaluateChunk("print(1)\n");

    expect(errors).toHaveLength(1);
  });

  test("a genuine compile-time error (e.g. name error) reports via sendError, not a thrown exception", async () => {
    const { conductor, errors } = makeMockConductor();
    const evaluator = new PyPvmlPynterEvaluator(conductor);

    await evaluator.evaluateChunk("undefined_name\n");

    expect(errors).toHaveLength(1);
  });

  test("each evaluateChunk call is independent — an earlier chunk's bindings are not visible to a later one", async () => {
    // Unlike PyPvmlEvaluator/PyCseEvaluator (which persist a global
    // environment across evaluateChunk calls for REPL-style use — see
    // PyPvmlEvaluatorBase's doc comment), PyPvmlPynterEvaluator compiles and
    // runs each chunk as its own self-contained program (see
    // PyPvmlPynterEvaluator.ts). A name defined in one chunk is gone by the
    // next: the second call below fails at analysis time, before WASM is
    // even touched.
    const { conductor, errors } = makeMockConductor();
    const evaluator = new PyPvmlPynterEvaluator(conductor);

    await evaluator.evaluateChunk("x = 5\n");
    await evaluator.evaluateChunk("print(x + 1)\n");

    expect(errors).toHaveLength(2);
    expect(String(errors[1])).toMatch(/not found/i);
  });
});

describe("isPynterWasmResultTrailer", () => {
  // The success trailer is pure noise — evaluateChunk already reads the
  // result value directly off siwasm_run's return pointer — so it's just
  // dropped, with nothing captured out of it.
  test.each([
    "Program exited with result type undefined: undefined",
    "Program exited with result type integer: 42",
  ])("matches the WASM success trailer line %j", text => {
    expect(isPynterWasmResultTrailer(text)).toBe(true);
  });

  test.each(["42", "Program exited early", "Program exited unsuccessfully: divide by zero"])(
    "does not match %j",
    text => {
      expect(isPynterWasmResultTrailer(text)).toBe(false);
    },
  );
});

describe("matchPynterWasmFaultTrailer", () => {
  // On a fault, siwasm_run's return pointer is left zeroed (type 0), so this
  // trailer is the ONLY place the fault name (e.g. "divide by zero",
  // "program called error()") appears — it must be captured, not just
  // dropped like the success trailer, or the fault reason is lost entirely
  // rather than merely mislabeled as program output.
  test.each([
    ["Program exited unsuccessfully: divide by zero", "divide by zero"],
    ["Program exited unsuccessfully: program called error()", "program called error()"],
    ["Program exited unsuccessfully: index error", "index error"],
  ])("captures the fault name out of %j", (text, expected) => {
    expect(matchPynterWasmFaultTrailer(text)).toBe(expected);
  });

  test.each([
    "42",
    "Program exited early",
    "Program exited with result type undefined: undefined",
  ])("does not match %j", text => {
    expect(matchPynterWasmFaultTrailer(text)).toBeUndefined();
  });
});

describe("PyPvmlPynterEvaluator fault handling", () => {
  // Simulates what the real WASM print callback would receive on a fault
  // (see lib.c: it prints the fault trailer, then siwasm_run returns a
  // zeroed result pointer, so readReturnValue's default case throws
  // "Unknown return type: 0" — reproduced here directly since Jest can't run
  // the actual WASM module). Confirms the evaluator turns that opaque throw
  // into an error naming the actual fault, using the trailer text it
  // captured along the way, rather than losing the fault name once the
  // trailer line itself stops being forwarded to sendOutput.
  test("a captured fault trailer produces a fault-named error instead of the raw 'Unknown return type' throw", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlPynterEvaluator(conductor);
    const mutableEvaluator = evaluator as unknown as {
      lastFault: string | undefined;
      pynter: unknown;
    };

    // evaluateChunk resets lastFault right before calling runBinary, then
    // the real print callback would set it back during that synchronous
    // WASM call (before siwasm_run's return throws readReturnValue's generic
    // error) — reproduced here by having the mock runBinary do the same.
    mutableEvaluator.pynter = {
      runBinary: () => {
        mutableEvaluator.lastFault = "program called error()";
        throw new Error("Unknown return type: 0");
      },
    };

    await evaluator.evaluateChunk("error('asdf')\n");

    expect(outputs).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(String(errors[0])).toContain("program called error()");
    expect(String(errors[0])).not.toMatch(/Unknown return type/);
  });
});
