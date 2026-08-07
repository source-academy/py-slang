/**
 * Conductor-evaluator tests for the Python stepper (mirrors Py2JsEvaluator.test.ts).
 *
 * py-slang#421: a Python script run through the stepper must report `undefined` as its result,
 * exactly like every other exec-mode evaluator here (Py2JsEvaluator, PyodideEvaluator) — a program's
 * last expression is not a value the way a REPL expression's is. The stepper evaluator used to
 * separately re-derive and send that expression's text, which (besides being wrong for Python's exec
 * model) left a stale string in the host's REPL even after switching away to a different evaluator
 * without re-running anything.
 */
import type { StepperMessage } from "@sourceacademy/common-stepper";
import type { IChannel, IConduit } from "@sourceacademy/conductor/conduit";
import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";

import { PyStepperEvaluator1, PyStepperEvaluator2 } from "../conductor/PyStepperEvaluator";
import { PythonStepperRunnerPlugin } from "../conductor/stepper/PyStepperRunnerPlugin";

/** A minimal, non-functional IChannel — PythonStepperRunnerPlugin only needs one to exist to
 * construct (it sends steps through it, which this test never inspects). */
function makeFakeChannel(): IChannel<StepperMessage> {
  return {
    name: "fake",
    send: () => {},
    subscribe: () => {},
    unsubscribe: () => {},
    close: () => {},
  };
}

/** Minimal IRunnerPlugin mock: unlike Py2JsEvaluator.test.ts's identical helper, `registerPlugin`
 * must actually construct a real PythonStepperRunnerPlugin (not just return undefined) — the
 * evaluator stores its return value as `this.stepper` and calls `sendSteps` on it, so a stub would
 * make every test pass trivially without exercising the real stepping path. Every other
 * `registerPlugin` call here (AutoCompletePlugin, ModuleLoaderRunnerPlugin) is fire-and-forget from
 * the evaluator's own perspective, so `undefined` is fine for those. */
function makeMockConductor() {
  const results: unknown[] = [];
  const errors: { name: string; message: string }[] = [];
  const conductor = {
    sendResult: (r: unknown) => results.push(r),
    sendError: (e: unknown) => errors.push(e as { name: string; message: string }),
    updateStatus: () => undefined,
    registerPlugin: (PluginClass: unknown, ...args: unknown[]) =>
      PluginClass === PythonStepperRunnerPlugin
        ? new PythonStepperRunnerPlugin(
            {} as IConduit,
            [makeFakeChannel()],
            ...(args as [ConstructorParameters<typeof PythonStepperRunnerPlugin>[2]]),
          )
        : undefined,
    hostLoadPlugin: () => undefined,
    requestInput: () => Promise.resolve(""),
    // fetchRunConfig (runConfig.ts) reads "/__cse_config__" for breakpoint lines/step limit before
    // every run; undefined means "no config", same as a real host with none set.
    requestFile: () => Promise.resolve(undefined),
  } as unknown as IRunnerPlugin;
  return { conductor, results, errors };
}

describe("PyStepperEvaluator1", () => {
  test("a script's result is always undefined, exec-mode style, even for a bare expression (py-slang#421)", async () => {
    const { conductor, results, errors } = makeMockConductor();
    const evaluator = new PyStepperEvaluator1(conductor);

    await evaluator.evaluateChunk("1 + 2\n");

    expect(errors).toEqual([]);
    expect(results).toEqual([undefined]);
  });

  test("a program with print() output and no trailing expression is also undefined", async () => {
    const { conductor, results, errors } = makeMockConductor();
    const evaluator = new PyStepperEvaluator1(conductor);

    await evaluator.evaluateChunk("x = 5\nprint(x + 1)\n");

    expect(errors).toEqual([]);
    expect(results).toEqual([undefined]);
  });

  test("a preprocessing error still reports through sendError, not sendResult", async () => {
    const { conductor, results, errors } = makeMockConductor();
    const evaluator = new PyStepperEvaluator1(conductor);

    await evaluator.evaluateChunk("print(nope)\n");

    expect(results).toEqual([]);
    expect(errors).toHaveLength(1);
  });
});

describe("PyStepperEvaluator2", () => {
  test("a script's result is undefined at chapter 2 too", async () => {
    const { conductor, results, errors } = makeMockConductor();
    const evaluator = new PyStepperEvaluator2(conductor);

    await evaluator.evaluateChunk("xs = pair(1, pair(2, None))\nlength(xs)\n");

    expect(errors).toEqual([]);
    expect(results).toEqual([undefined]);
  });
});
