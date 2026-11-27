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
import { CSE_STEP_CAP } from "../conductor/runConfig";
import {
  PyCseEvaluator1,
  PyCseEvaluator2,
  PyCseEvaluator3,
  PyCseEvaluator4,
} from "../conductor/PyCseEvaluator";

/** Minimal IRunnerPlugin mock. PyCseEvaluatorBase's constructor unconditionally registers
 * CseMachinePlugin (used by evaluateChunk via `this.csePlugin.sendBatch(...)` and `endRun(...)`,
 * without optional chaining, once variant >= 3) and the autocomplete plugin, plus - for variant >= 2 -
 * PythonDataVisualizerRunnerPlugin (used via `this.dataVisualizerPlugin?.resetRun()`). One
 * generic stub covers every registerPlugin call: only the methods each plugin path actually
 * invokes need to exist. */
function makeMockConductor(files: Record<string, string> = {}) {
  const results: unknown[] = [];
  const errors: unknown[] = [];
  const outputs: string[] = [];
  // The snapshots reach the plugin in batches while the run goes on, and the run is ended with
  // `endRun`. `sendSnapshots` is that run as a whole, called once when it ends with all its
  // snapshots and breakpoint steps (and how it ended), which is what most tests look at.
  const sendSnapshots = jest.fn();
  const batches: { snapshots: unknown[]; breakpointSteps: number[] }[] = [];
  const ends: unknown[] = [];
  let run: { snapshots: unknown[]; breakpointSteps: number[] }[] = [];
  const sendBatch = jest.fn((snapshots: unknown[], breakpointSteps: number[] = []) => {
    const batch = { snapshots, breakpointSteps };
    batches.push(batch);
    run.push(batch);
  });
  const endRun = jest.fn((end: unknown) => {
    ends.push(end);
    sendSnapshots(
      run.flatMap(batch => batch.snapshots),
      run.flatMap(batch => batch.breakpointSteps),
      end,
    );
    run = [];
  });
  const resetRun = jest.fn().mockResolvedValue(undefined);
  const hostLoadPlugin = jest.fn(() => Promise.resolve());
  const conductor = {
    requestFile: (name: string) => Promise.resolve(files[name]),
    sendResult: (r: unknown) => results.push(r),
    sendError: (e: unknown) => errors.push(e),
    sendOutput: (m: string) => outputs.push(m),
    registerPlugin: () => ({ sendBatch, endRun, resetRun }),
    hostLoadPlugin,
  } as unknown as IRunnerPlugin;
  return { conductor, results, errors, outputs, sendSnapshots, batches, ends, hostLoadPlugin };
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

  test("the step limit is the number at the slider's right end: one less than the snapshots", async () => {
    for (const stepLimit of [1, 10, 11]) {
      const { conductor, errors, sendSnapshots } = makeMockConductor({
        "/__cse_config__": JSON.stringify({ stepLimit }),
      });
      const evaluator = new PyCseEvaluator3(conductor);
      await evaluator.evaluateChunk("x = 0\nwhile True:\n    x = x + 1");
      expect(errors).toEqual([]);
      const [snapshots] = sendSnapshots.mock.calls[0];
      // The slider runs from 0 (the first snapshot): its right end is stepLimit.
      expect(snapshots.length - 1).toBe(stepLimit);
    }
  });

  test("gutter-click breakpoint lines from /__cse_config__ (#383) surface in sendSnapshots", async () => {
    // The host has no dedicated message for gutter clicks; it serves them through the same
    // /__cse_config__ virtual file evaluateChunk already fetches stepLimit from (see runConfig.ts).
    const { conductor, errors, sendSnapshots } = makeMockConductor({
      "/__cse_config__": JSON.stringify({ breakpointLines: [2] }),
    });
    const evaluator = new PyCseEvaluator3(conductor);

    await evaluator.evaluateChunk("x = 1\ny = 2");

    expect(errors).toEqual([]);
    expect(sendSnapshots).toHaveBeenCalledTimes(1);
    const [, breakpointSteps] = sendSnapshots.mock.calls[0];
    expect(breakpointSteps.length).toBeGreaterThan(0);
  });

  test("gutter-click breakpoint lines don't leak into a chunk that didn't request them", async () => {
    // Same evaluator and conductor across both calls, mutating the mocked /__cse_config__ file in
    // between - unlike a fresh evaluator (which would trivially start with no breakpointSteps
    // regardless of any reset logic), this actually exercises evaluateChunk's per-run reset
    // (this.context.runtime.breakpointSteps = []; see PyCseEvaluator.ts), the same reset the
    // breakpoint()-leak test above exercises for an explicit breakpoint() call.
    const files: Record<string, string> = {
      "/__cse_config__": JSON.stringify({ breakpointLines: [1] }),
    };
    const { conductor, errors, sendSnapshots } = makeMockConductor(files);
    const evaluator = new PyCseEvaluator3(conductor);

    await evaluator.evaluateChunk("x = 1");
    expect(errors).toEqual([]);
    const [, firstBreakpointSteps] = sendSnapshots.mock.calls[0];
    expect(firstBreakpointSteps.length).toBeGreaterThan(0);

    delete files["/__cse_config__"];
    await evaluator.evaluateChunk("x = 1");
    expect(errors).toEqual([]);
    const [, secondBreakpointSteps] = sendSnapshots.mock.calls[1];
    expect(secondBreakpointSteps).toEqual([]);
  });
});

// PyCseEvaluator1..4 wire the CSE machine to a specific SICPy chapter's
// validators + stdlib groups (see VARIANT_GROUPS in ../runner.ts). These
// smoke tests exist to confirm chapter selection works end to end through
// the real evaluateChunk() path - not to re-litigate what each chapter
// allows (see src/validator/sublanguages.ts for that).
describe("PyCseEvaluator3/4 (streaming)", () => {
  const LOOP = (n: number) => `i = 0\nwhile i < ${n}:\n    i = i + 1\n`;
  const config = (stepLimit: number): Record<string, string> => ({
    "/__cse_config__": JSON.stringify({ stepLimit }),
  });

  test("the snapshots go out in batches while the run goes on, and the run ends complete", async () => {
    const { conductor, batches, ends, errors } = makeMockConductor();
    await new PyCseEvaluator3(conductor).evaluateChunk(LOOP(30));

    expect(errors).toEqual([]);
    expect(batches.length).toBeGreaterThan(1);
    for (const batch of batches.slice(0, -1)) expect(batch.snapshots).toHaveLength(25);
    expect(ends).toEqual([{ status: "complete" }]);
  });

  test("without a host limit, a long run is cut off at the machine's own cap, and says why", async () => {
    const { conductor, batches, ends } = makeMockConductor();
    await new PyCseEvaluator3(conductor).evaluateChunk(LOOP(100000));

    // The slider counts steps taken, from 0: its right end is the cap, one less than the snapshots.
    expect(batches.flatMap(batch => batch.snapshots)).toHaveLength(CSE_STEP_CAP + 1);
    expect(ends).toEqual([
      { status: "cut-off", reason: `the limit of ${CSE_STEP_CAP} steps was reached` },
    ]);
  });

  test("the host's limit caps what is sent, and the run says that it was cut off by it", async () => {
    const { conductor, batches, ends } = makeMockConductor(config(12));
    await new PyCseEvaluator3(conductor).evaluateChunk(LOOP(100000));

    expect(batches.flatMap(batch => batch.snapshots)).toHaveLength(13);
    expect(ends).toEqual([{ status: "cut-off", reason: "the limit of 12 steps was reached" }]);
  });

  test("a host limit above the cap does not raise it", async () => {
    const { conductor, batches } = makeMockConductor(config(10 * CSE_STEP_CAP));
    await new PyCseEvaluator3(conductor).evaluateChunk(LOOP(100000));

    expect(batches.flatMap(batch => batch.snapshots)).toHaveLength(CSE_STEP_CAP + 1);
  });

  test("a program that fails keeps the steps up to the failure, ends the run, and reports the error", async () => {
    const { conductor, batches, ends, errors } = makeMockConductor();
    await new PyCseEvaluator3(conductor).evaluateChunk(`${LOOP(40)}1 / 0\n`);

    expect(batches.flatMap(batch => batch.snapshots).length).toBeGreaterThan(25);
    expect(ends).toEqual([{ status: "complete" }]);
    expect(errors).toHaveLength(1);
  });

  test("each chunk is a run of its own, ended once", async () => {
    const { conductor, ends } = makeMockConductor();
    const evaluator = new PyCseEvaluator3(conductor);
    await evaluator.evaluateChunk("x = 1\n");
    await evaluator.evaluateChunk("y = x + 1\n");

    expect(ends).toEqual([{ status: "complete" }, { status: "complete" }]);
  });
});

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

describe("the CSE machine plugin", () => {
  test("is loaded by the evaluators of Python §3 and §4, which send snapshots", () => {
    for (const Evaluator of [PyCseEvaluator3, PyCseEvaluator4]) {
      const { conductor, hostLoadPlugin } = makeMockConductor();
      new Evaluator(conductor);
      expect(hostLoadPlugin).toHaveBeenCalledWith("cse-machine");
    }
  });

  test("is not loaded by those of §1 and §2, which have no snapshots to show", () => {
    for (const Evaluator of [PyCseEvaluator1, PyCseEvaluator2]) {
      const { conductor, hostLoadPlugin } = makeMockConductor();
      new Evaluator(conductor);
      expect(hostLoadPlugin).not.toHaveBeenCalledWith("cse-machine");
    }
  });
});
