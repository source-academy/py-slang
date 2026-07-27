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
    const { conductor, results, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator(conductor);

    await evaluator.evaluateChunk("x = 5\n");
    await evaluator.evaluateChunk("print(x + 1)\n");

    expect(errors).toEqual([]);
    // This evaluator strictly targets exec mode, like a real Python script
    // (see pvml-compiler.ts's visitFileInputStmt doc comment) — every chunk
    // reports no result at all, regardless of what it computed; a chunk
    // that wants to surface a value print()s it explicitly.
    expect(results).toEqual([undefined, undefined]);
    expect(outputs).toEqual(["6"]);
  });

  test("persists a function definition across evaluateChunk calls", async () => {
    const { conductor, results, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator(conductor);

    await evaluator.evaluateChunk("def f(x):\n    return x * 2\n");
    await evaluator.evaluateChunk("print(f(21))\n");

    expect(errors).toEqual([]);
    expect(results).toEqual([undefined, undefined]);
    expect(outputs).toEqual(["42"]);
  });

  test("loads the linked-list prelude (pair/head/tail available from the first chunk)", async () => {
    const { conductor, results, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator(conductor);

    await evaluator.evaluateChunk("print(head(pair(1, 2)))\n");

    expect(errors).toEqual([]);
    expect(results).toEqual([undefined]);
    expect(outputs).toEqual(["1"]);
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
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator1(conductor);

    await evaluator.evaluateChunk("def f(x):\n    return x + 1\nprint(f(5))\n");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["6"]);
  });

  test("chapter 1: list literals are rejected by the chapter's validators", async () => {
    const { conductor, errors } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator1(conductor);

    await evaluator.evaluateChunk("[1, 2, 3]\n");

    expect(errors).toHaveLength(1);
  });

  test("chapter 2: linked-list prelude is available", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator2(conductor);

    await evaluator.evaluateChunk("print(head(pair(1, 2)))\n");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["1"]);
  });

  test("chapter 2: list literals are still rejected", async () => {
    const { conductor, errors } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator2(conductor);

    await evaluator.evaluateChunk("[1, 2, 3]\n");

    expect(errors).toHaveLength(1);
  });

  test("chapter 3: list literals and for-loops over range() work", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator3(conductor);

    await evaluator.evaluateChunk("print([1, 2, 3][0])\n");
    await evaluator.evaluateChunk(
      "total = 0\nfor i in range(3):\n    total = total + i\nprint(total)\n",
    );

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["1", "3"]);
  });

  test("chapter 3: for-loops over a non-range iterable are rejected", async () => {
    const { conductor, errors } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator3(conductor);

    await evaluator.evaluateChunk("for x in [1, 2, 3]:\n    x\n");

    expect(errors).toHaveLength(1);
  });

  test("chapter 4: closures and `is` work; for-loops still require range()", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator4(conductor);

    await evaluator.evaluateChunk(
      "def make_adder(n):\n    def add(x):\n        return x + n\n    return add\nadd3 = make_adder(3)\nprint(add3(7))\n",
    );
    await evaluator.evaluateChunk("print(1 is 1)\n");
    await evaluator.evaluateChunk(
      "xs = [1, 2, 3]\nlast = 0\nfor i in range(len(xs)):\n    last = xs[i]\nprint(last)\n",
    );

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["10", "True", "3"]);
  });

  test("chapter 4: for-loops over a non-range iterable are rejected", async () => {
    const { conductor, errors } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator4(conductor);

    await evaluator.evaluateChunk("for x in [1, 2, 3]:\n    x\n");

    expect(errors).toHaveLength(1);
  });
});
