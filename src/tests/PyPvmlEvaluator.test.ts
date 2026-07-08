import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { PyPvmlEvaluator } from "../conductor/PyPvmlEvaluator";

/** Minimal IRunnerPlugin mock: PyPvmlEvaluator only ever calls sendResult/
 * sendError/sendOutput on its `conductor`. */
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

describe("PyPvmlEvaluator", () => {
  test("persists a global variable across evaluateChunk calls", async () => {
    const { conductor, results, errors } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator(conductor);

    await evaluator.evaluateChunk("x = 5\n");
    await evaluator.evaluateChunk("x + 1\n");

    expect(errors).toEqual([]);
    // Python `int` results are genuine bigints (see PVMLType.BIGINT) — this
    // preserves full precision across the real evaluator/conductor pathway.
    expect(results).toEqual([undefined, 6n]);
  });

  test("persists a function definition across evaluateChunk calls", async () => {
    const { conductor, results, errors } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator(conductor);

    await evaluator.evaluateChunk("def f(x):\n    return x * 2\n");
    await evaluator.evaluateChunk("f(21)\n");

    expect(errors).toEqual([]);
    expect(results).toEqual([undefined, 42n]);
  });

  test("loads the linked-list prelude (pair/head/tail available from the first chunk)", async () => {
    const { conductor, results, errors } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator(conductor);

    await evaluator.evaluateChunk("head(pair(1, 2))\n");

    expect(errors).toEqual([]);
    expect(results).toEqual([1n]);
  });

  test("output via print() is forwarded to the conductor", async () => {
    const { conductor, outputs, errors } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator(conductor);

    await evaluator.evaluateChunk('print("hello")\n');

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["hello"]);
  });

  test("a genuine error (e.g. name error) reports via sendError, not a thrown exception", async () => {
    const { conductor, errors } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator(conductor);

    await evaluator.evaluateChunk("undefined_name\n");

    expect(errors).toHaveLength(1);
  });
});
