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
 * construct. `sent` records every message pushed through it (e.g. sendSteps's "steps" message),
 * so tests can inspect the produced steps without reaching into the plugin's private state. */
function makeFakeChannel(sent: StepperMessage[] = []): IChannel<StepperMessage> {
  return {
    name: "fake",
    send: (m: StepperMessage) => {
      sent.push(m);
    },
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
 * the evaluator's own perspective, so `undefined` is fine for those.
 *
 * `stepLimit`, when given, is served back from `requestFile("/__cse_config__")` — mirroring the
 * host's real per-run config (`runConfig.ts`) — so tests can verify it reaches the stepper. */
function makeMockConductor(stepLimit?: number) {
  const results: unknown[] = [];
  const errors: { name: string; message: string }[] = [];
  const sent: StepperMessage[] = [];
  const conductor = {
    sendResult: (r: unknown) => results.push(r),
    sendError: (e: unknown) => errors.push(e as { name: string; message: string }),
    updateStatus: () => undefined,
    registerPlugin: (PluginClass: unknown, ...args: unknown[]) =>
      PluginClass === PythonStepperRunnerPlugin
        ? new PythonStepperRunnerPlugin(
            {} as IConduit,
            [makeFakeChannel(sent)],
            ...(args as [ConstructorParameters<typeof PythonStepperRunnerPlugin>[2]]),
          )
        : undefined,
    hostLoadPlugin: () => undefined,
    requestInput: () => Promise.resolve(""),
    // fetchRunConfig (runConfig.ts) reads "/__cse_config__" for breakpoint lines/step limit before
    // every run; undefined means "no config", same as a real host with none set.
    requestFile: () =>
      Promise.resolve(stepLimit === undefined ? undefined : JSON.stringify({ stepLimit })),
  } as unknown as IRunnerPlugin;
  return { conductor, results, errors, sent };
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

  test("the host-configured stepLimit (the frontend's Step Limit control) is applied, not the 1000 default", async () => {
    const { conductor, sent } = makeMockConductor(3);
    const evaluator = new PyStepperEvaluator1(conductor);

    // §1 has no while loops (see preprocessPython), so use non-terminating recursion instead.
    await evaluator.evaluateChunk("def f(x):\n  return f(x)\nf(1)\n");

    const stepsMessage = sent.find(m => m.type === "steps") as { steps: { markers: unknown[] }[] };
    const explanations = stepsMessage.steps.flatMap(s =>
      (s.markers as { explanation?: string }[]).map(m => m.explanation),
    );
    expect(explanations).toContain("Maximum number of steps exceeded");
    // A stepLimit of 3 must produce far fewer steps than the 1000 default would for the same
    // non-terminating loop — confirms the host's value actually reached the stepper.
    expect(stepsMessage.steps.length).toBeLessThan(10);
  });

  test("with no host config, the stepper falls back to its own default step limit", async () => {
    const { conductor, sent } = makeMockConductor();
    const evaluator = new PyStepperEvaluator1(conductor);

    await evaluator.evaluateChunk("def f(x):\n  return f(x)\nf(1)\n");

    const stepsMessage = sent.find(m => m.type === "steps") as { steps: unknown[] };
    expect(stepsMessage.steps.length).toBeGreaterThan(10);
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
