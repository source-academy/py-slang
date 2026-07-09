import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import {
  PyPvmlEvaluator,
  PyPvmlEvaluator1,
  PyPvmlEvaluator2,
  PyPvmlEvaluator3,
  PyPvmlEvaluator4,
} from "../conductor/PyPvmlEvaluator";

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

// PyPvmlEvaluator1..4 mirror PyCseEvaluator1..4 (see PyCseEvaluator.ts): each
// wires the PVML browser pathway to a specific SICPy chapter's validators +
// stdlib groups (see PyPvmlEvaluator.ts / VARIANT_GROUPS in ../runner.ts).
// These smoke tests exist to confirm chapter selection actually works end to
// end — not to re-litigate what each chapter allows (see
// src/validator/sublanguages.ts for that).
describe("PyPvmlEvaluator1..4 (chapter selection)", () => {
  test("chapter 1: basic functions work", async () => {
    const { conductor, results, errors } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator1(conductor);

    await evaluator.evaluateChunk("def f(x):\n    return x + 1\nf(5)\n");

    expect(errors).toEqual([]);
    expect(results).toEqual([6n]);
  });

  test("chapter 1: list literals are rejected by the chapter's validators", async () => {
    const { conductor, errors } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator1(conductor);

    await evaluator.evaluateChunk("[1, 2, 3]\n");

    expect(errors).toHaveLength(1);
  });

  test("chapter 2: linked-list prelude is available", async () => {
    const { conductor, results, errors } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator2(conductor);

    await evaluator.evaluateChunk("head(pair(1, 2))\n");

    expect(errors).toEqual([]);
    expect(results).toEqual([1n]);
  });

  test("chapter 2: list literals are still rejected", async () => {
    const { conductor, errors } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator2(conductor);

    await evaluator.evaluateChunk("[1, 2, 3]\n");

    expect(errors).toHaveLength(1);
  });

  test("chapter 3: list literals and for-loops over range() work", async () => {
    const { conductor, results, errors } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator3(conductor);

    await evaluator.evaluateChunk("[1, 2, 3][0]\n");
    await evaluator.evaluateChunk("total = 0\nfor i in range(3):\n    total = total + i\ntotal\n");

    expect(errors).toEqual([]);
    expect(results).toEqual([1n, 3n]);
  });

  test("chapter 3: for-loops over a non-range iterable are rejected", async () => {
    const { conductor, errors } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator3(conductor);

    await evaluator.evaluateChunk("for x in [1, 2, 3]:\n    x\n");

    expect(errors).toHaveLength(1);
  });

  test("chapter 4: closures, `is`, and for-loops over any iterable work", async () => {
    const { conductor, results, errors } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator4(conductor);

    await evaluator.evaluateChunk(
      "def make_adder(n):\n    def add(x):\n        return x + n\n    return add\nadd3 = make_adder(3)\nadd3(7)\n",
    );
    await evaluator.evaluateChunk("1 is 1\n");
    await evaluator.evaluateChunk("last = 0\nfor x in [1, 2, 3]:\n    last = x\nlast\n");

    expect(errors).toEqual([]);
    expect(results).toEqual([10n, true, 3n]);
  });
});
