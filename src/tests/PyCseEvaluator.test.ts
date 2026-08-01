/**
 * Conductor-evaluator tests for the CSE machine (mirrors Py2JsEvaluator.test.ts
 * and PyPvmlEvaluator.test.ts).
 *
 * PyCseEvaluatorBase's `this.context` is a single instance field that
 * survives across evaluateChunk() calls (see PyCseEvaluator.ts's own doc
 * comment on that field) - this is the actual mechanism a persistent REPL
 * session (source-academy/py-slang#359) depends on once
 * @sourceacademy/conductor's BasicEvaluator.startEvaluator loops on further
 * chunks instead of stopping after the first. Until now this repo had no
 * test driving PyCseEvaluatorBase itself (as opposed to the lower-level
 * evaluate()/runInContext() helpers utils.ts's generateTestCases() uses)
 * through more than one evaluateChunk() call.
 */
import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import {
  PyCseEvaluator1,
  PyCseEvaluator2,
  PyCseEvaluator3,
  PyCseEvaluator4,
} from "../conductor/PyCseEvaluator";

/** Minimal IRunnerPlugin mock. PyCseEvaluatorBase's constructor unconditionally registers
 * CseMachinePlugin (used by evaluateChunk via `this.csePlugin.sendSnapshots(...)`, without
 * optional chaining, once variant >= 3) and the autocomplete plugin, plus - for variant >= 2 -
 * PythonDataVisualizerRunnerPlugin (used via `this.dataVisualizerPlugin?.resetRun()`). One
 * generic stub covers every registerPlugin call: only the methods each plugin path actually
 * invokes need to exist. */
function makeMockConductor() {
  const results: unknown[] = [];
  const errors: unknown[] = [];
  const outputs: string[] = [];
  const sendSnapshots = jest.fn();
  const resetRun = jest.fn().mockResolvedValue(undefined);
  const conductor = {
    requestFile: () => Promise.resolve(undefined),
    sendResult: (r: unknown) => results.push(r),
    sendError: (e: unknown) => errors.push(e),
    sendOutput: (m: string) => outputs.push(m),
    registerPlugin: () => ({ sendSnapshots, resetRun }),
    hostLoadPlugin: () => Promise.resolve(),
  } as unknown as IRunnerPlugin;
  return { conductor, results, errors, outputs, sendSnapshots };
}

describe("PyCseEvaluator1 (chapter 1, no CSE snapshots)", () => {
  test("persists a global variable across evaluateChunk calls", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyCseEvaluator1(conductor);

    await evaluator.evaluateChunk("x = 5");
    await evaluator.evaluateChunk("print(x + 1)");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["6\n"]);
  });

  test("persists a function definition across evaluateChunk calls", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyCseEvaluator1(conductor);

    await evaluator.evaluateChunk("def f(x):\n    return x * 2");
    await evaluator.evaluateChunk("print(f(21))");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["42\n"]);
  });

  test("an erroring chunk reports through sendError and does not kill the session", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyCseEvaluator1(conductor);

    await evaluator.evaluateChunk("x = 10");
    await evaluator.evaluateChunk("print(1 / 0)");
    await evaluator.evaluateChunk("print(x)");

    expect(errors).toHaveLength(1);
    expect(outputs).toEqual(["10\n"]);
  });

  test("a name unknown to the resolver is reported per-chunk, not fatal to the session", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyCseEvaluator1(conductor);

    await evaluator.evaluateChunk("x = 1");
    await evaluator.evaluateChunk("print(nope)");
    await evaluator.evaluateChunk("print(x)");

    expect(errors).toHaveLength(1);
    expect(outputs).toEqual(["1\n"]);
  });

  test("a relative import ('from .foo import x') is rejected, not silently treated as a conductor module", async () => {
    // CSE doesn't implement local-file imports (see py2js) — this must
    // reject explicitly rather than requesting a conductor module literally
    // named "foo".
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyCseEvaluator1(conductor);

    await evaluator.evaluateChunk("from .foo import x\n");

    expect(errors).toHaveLength(1);
    expect((errors[0] as { message: string }).message).toMatch(/relative imports/);
    expect(outputs).toEqual([]);
  });
});

describe("PyCseEvaluator3/4 (CSE snapshots)", () => {
  test("sendSnapshots is called once per chunk, each reflecting only that chunk's own control/stash", async () => {
    const { conductor, errors, outputs, sendSnapshots } = makeMockConductor();
    const evaluator = new PyCseEvaluator3(conductor);

    await evaluator.evaluateChunk("x = 1");
    await evaluator.evaluateChunk("print(x + 1)");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["2\n"]);
    expect(sendSnapshots).toHaveBeenCalledTimes(2);
    // Each call's snapshot list is non-empty (the CSE machine actually ran, on a control/stash
    // reinitialized for that chunk alone) - a stale/shared control between chunks would either
    // throw (re-running an already-consumed Control) or silently replay chunk 1's assignment.
    for (const [snapshots] of sendSnapshots.mock.calls) {
      expect(Array.isArray(snapshots)).toBe(true);
      expect(snapshots.length).toBeGreaterThan(0);
    }
  });

  test("breakpoint() steps from one chunk don't leak into the next chunk's snapshot batch", async () => {
    const { conductor, errors, sendSnapshots } = makeMockConductor();
    const evaluator = new PyCseEvaluator3(conductor);

    await evaluator.evaluateChunk("x = 1\nbreakpoint()\nx = 2");
    await evaluator.evaluateChunk("x = 3");

    expect(errors).toEqual([]);
    expect(sendSnapshots).toHaveBeenCalledTimes(2);
    const [, firstBreakpointSteps] = sendSnapshots.mock.calls[0];
    const [, secondBreakpointSteps] = sendSnapshots.mock.calls[1];
    expect(firstBreakpointSteps.length).toBeGreaterThan(0);
    expect(secondBreakpointSteps).toEqual([]);
  });
});

// PyCseEvaluator1..4 wire the CSE machine to a specific SICPy chapter's
// validators + stdlib groups (see VARIANT_GROUPS in ../runner.ts). These
// smoke tests exist to confirm chapter selection works end to end through
// the real evaluateChunk() path - not to re-litigate what each chapter
// allows (see src/validator/sublanguages.ts for that).
describe("PyCseEvaluator1..4 (chapter selection)", () => {
  test("chapter 1: list literals are rejected by the chapter's validators", async () => {
    const { conductor, errors } = makeMockConductor();
    const evaluator = new PyCseEvaluator1(conductor);

    await evaluator.evaluateChunk("[1, 2, 3]");

    expect(errors).toHaveLength(1);
  });

  test("chapter 2: linked-list prelude is available", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyCseEvaluator2(conductor);

    await evaluator.evaluateChunk("print(head(pair(1, 2)))");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["1\n"]);
  });

  test("chapter 3: list literals and for-loops over range() work", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyCseEvaluator3(conductor);

    await evaluator.evaluateChunk("print([1, 2, 3][0])");
    await evaluator.evaluateChunk(
      "total = 0\nfor i in range(3):\n    total = total + i\nprint(total)",
    );

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["1\n", "3\n"]);
  });

  test("chapter 4: closures and `is` work across chunks", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyCseEvaluator4(conductor);

    await evaluator.evaluateChunk(
      "def make_adder(n):\n    def add(x):\n        return x + n\n    return add\nadd3 = make_adder(3)",
    );
    await evaluator.evaluateChunk("print(add3(7))");
    await evaluator.evaluateChunk("print(1 is 1)");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["10\n", "True\n"]);
  });
});
