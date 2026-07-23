import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { PyPvmlPynterEvaluator } from "../conductor/PyPvmlPynterEvaluator";

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
