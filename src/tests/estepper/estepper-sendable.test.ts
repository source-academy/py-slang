/**
 * The steps go to the page in a message, which the browser copies with its structured clone; that
 * overflows the stack on a term nested deeper than it can handle (py-slang#610). The run then ends
 * at the last step that can be copied, with a RecursionError, instead of failing in the send with
 * the browser's "Failed to execute 'postMessage' ... Maximum call stack size exceeded".
 */
import { runEStepper, sendableSteps, type Step } from "../../conductor/estepper/getSteps";
import { isStackOverflow, RECURSION_ERROR_MESSAGE } from "../../errors/recursion";
import { parse } from "../../parser";

const OVERFLOW = "Maximum call stack size exceeded";

const nested = (depth: number): object =>
  depth === 0 ? { type: "Identifier", name: "x" } : { type: "Unary", argument: nested(depth - 1) };

/** How deeply nested a message is (iteratively, as the test's own stack must not overflow). */
function depthOf(value: unknown): number {
  let deepest = 0;
  const pending: [unknown, number][] = [[value, 0]];
  for (let item = pending.pop(); item; item = pending.pop()) {
    deepest = Math.max(deepest, item[1]);
    if (item[0] !== null && typeof item[0] === "object") {
      for (const child of Object.values(item[0])) pending.push([child, item[1] + 1]);
    }
  }
  return deepest;
}

/** A post that, like the browser's, cannot copy what is nested deeper than `limit`. */
const postUpTo =
  (limit: number, failure: () => Error = () => new RangeError(OVERFLOW)) =>
  (message: unknown): void => {
    if (depthOf(message) > limit) throw failure();
  };

async function realSteps(): Promise<Step[]> {
  const code = "def f(x):\n    return x + 1\nf(1)\n";
  return (await runEStepper(parse(code), code, 3, 1000)).steps;
}

/** Steps like the real ones, the program of the i-th nested `depths[i]` deep. */
async function stepsOfDepths(depths: number[]): Promise<Step[]> {
  const [first] = await realSteps();
  return depths.map(
    (depth, i) =>
      ({
        ...first,
        ast: nested(depth),
        cse: { ...first.cse, stepIndex: i },
      }) as unknown as Step,
  );
}

describe("isStackOverflow", () => {
  test("the browser's copy of a term nested too deep", () => {
    const message = `Failed to execute 'postMessage' on 'MessagePort': ${OVERFLOW}`;
    expect(isStackOverflow(new DOMException(message, "DataCloneError"))).toBe(true);
    expect(isStackOverflow(new DOMException("could not be cloned.", "DataCloneError"))).toBe(false);
  });
});

describe("sendableSteps", () => {
  test("the steps of a run are sent as they are", async () => {
    const steps = await realSteps();
    expect(sendableSteps(steps)).toBe(steps);
  });

  test("steps that can all be copied are sent as they are", async () => {
    const steps = await stepsOfDepths([3, 8, 12, 12, 5]);
    expect(sendableSteps(steps, postUpTo(100))).toBe(steps);
  });

  test("the run ends at the last step before one that cannot be copied", async () => {
    const steps = await stepsOfDepths([3, 8, 12, 40, 50, 6]);
    const sent = sendableSteps(steps, postUpTo(25));
    expect(sent).toHaveLength(3 + 2);
    expect(sent.slice(0, 3)).toEqual(steps.slice(0, 3));
    expect(sent.slice(-2).map(s => s.markers?.[0]?.explanation)).toEqual([
      RECURSION_ERROR_MESSAGE,
      "Evaluation stuck",
    ]);
    expect(sent.map(s => s.cse?.stepIndex)).toEqual([0, 1, 2, 3, 4]);
    // what is sent can be copied
    for (const step of sent) expect(() => postUpTo(25)({ steps: [step] })).not.toThrow();
  });

  test("the deepest step is the only one tried when the steps can be sent", async () => {
    const steps = await stepsOfDepths([5, 5, 5, 9, 9, 7, 9, 20, 3]);
    const tried: number[] = [];
    const counting = (message: unknown): void => {
      tried.push(depthOf(message));
      postUpTo(100)(message);
    };
    expect(sendableSteps(steps, counting)).toBe(steps);
    expect(tried).toHaveLength(1);
    expect(tried[0]).toBeGreaterThan(20);
  });

  test("the depth that can be sent is found by halving the depths", async () => {
    const depths = Array.from({ length: 200 }, (_, i) => i * 3);
    const steps = await stepsOfDepths(depths);
    let tries = 0;
    const counting = (message: unknown): void => {
      tries++;
      postUpTo(301)(message); // the message adds 3 levels: a step up to 298 deep can be sent
    };
    const sent = sendableSteps(steps, counting);
    // the steps of depth 0 to 297 (the first 100), and the two steps of the error
    expect(sent).toHaveLength(100 + 2);
    expect(tries).toBeLessThanOrEqual(10);
  });

  test("steps that are not in order of depth are cut at the first that is too deep", async () => {
    const steps = await stepsOfDepths([3, 8, 40, 6, 50, 7]);
    const sent = sendableSteps(steps, postUpTo(25));
    expect(sent).toHaveLength(2 + 2);
  });

  test("a run whose first step is too deep ends with the first step that can be sent", async () => {
    const steps = await stepsOfDepths([40, 3, 8, 50]);
    const sent = sendableSteps(steps, postUpTo(25));
    expect(sent).toHaveLength(1 + 2);
    expect(sent[0]).toBe(steps[1]);
    expect(sent[1].markers?.[0]?.explanation).toBe(RECURSION_ERROR_MESSAGE);
  });

  test("a step is tried as the message it is sent in", async () => {
    const steps = await stepsOfDepths([4]);
    const seen: unknown[] = [];
    sendableSteps(steps, message => void seen.push(message));
    expect(seen).toEqual([{ type: "steps", steps: [steps[0]] }]);
  });

  test("the browser's DOMException is an overflow as well", async () => {
    const steps = await stepsOfDepths([3, 30]);
    const failure = () =>
      new DOMException(
        `Failed to execute 'postMessage' on 'MessagePort': ${OVERFLOW}`,
        "DataCloneError",
      );
    const sent = sendableSteps(steps, postUpTo(10, failure));
    expect(sent).toHaveLength(1 + 2);
    expect(sent[1].markers?.[0]?.explanation).toBe(RECURSION_ERROR_MESSAGE);
  });

  test("another failure of the copy is left to the send", async () => {
    const steps = await stepsOfDepths([3, 30]);
    const failure = () => new DOMException("A value could not be cloned.", "DataCloneError");
    expect(sendableSteps(steps, postUpTo(10, failure))).toBe(steps);
  });
});
