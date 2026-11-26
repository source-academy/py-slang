/**
 * The e-stepper sends its steps in batches while the run goes on, so that a run the host stops
 * still leaves the steps made so far. What is sent must be what the run sent whole, including the
 * end that a term too deep to copy gives it (py-slang#610).
 */
import type { StepperMessage } from "@sourceacademy/common-stepper";

import { E_STEPPER_STEP_CAP } from "../../conductor/runConfig";
import { PyEStepperRunnerPlugin } from "../../conductor/estepper/PyEStepperRunnerPlugin";
import {
  getEStepperStepBatches,
  runEStepper,
  SendGuard,
  sendableSteps,
  STEPS_PER_BATCH,
  type Step,
} from "../../conductor/estepper/getSteps";
import { RECURSION_ERROR_MESSAGE } from "../../errors/recursion";
import { parse } from "../../parser";

const OVERFLOW = "Maximum call stack size exceeded";

/**
 * The steps with the numeric ids of their heap objects numbered afresh, in order of appearance: those
 * come from a counter that goes on across the runs of one process (a run in a worker starts it at
 * its own start), so two runs of one program in one test differ by them alone.
 */
function renumbered(steps: unknown): unknown {
  const ids = new Map<string, number>();
  const text = JSON.stringify(steps, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  ).replace(/"id":(\d+)/g, (_m, id: string) => {
    if (!ids.has(id)) ids.set(id, ids.size + 1);
    return `"id":${ids.get(id)}`;
  });
  return JSON.parse(text);
}

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
  (limit: number) =>
  (message: unknown): void => {
    if (depthOf(message) > limit) throw new RangeError(OVERFLOW);
  };

const PROGRAMS: string[] = [
  "1 + 2 * 3\n",
  "x = 1\ny = x + 1\ny * 2\n",
  "def f(x):\n    return x + 1\nf(2)\n",
  "def fact(n):\n    return 1 if n == 0 else n * fact(n - 1)\nfact(6)\n",
  "print(1 + 1)\nprint(2)\n",
  "1 / 0\n",
  "xs = pair(1, pair(2, None))\nhead(tail(xs))\n",
  "def f(n):\n    return 0 if n == 0 else f(n - 1)\nf(40)\n",
  "g = lambda x: x * 2\ng(g(3))\n",
];

const DEEP = "def f(n):\n    return 0 if n == 0 else 1 + f(n - 1)\nf(60)\n";

async function collect(code: string, stepLimit: number, post?: (message: unknown) => void) {
  const generator = getEStepperStepBatches(
    parse(code),
    code,
    3,
    stepLimit,
    undefined,
    {},
    post ?? (() => {}),
  );
  const batches: Step[][] = [];
  let next = await generator.next();
  for (; !next.done; next = await generator.next()) batches.push(next.value);
  return { batches, end: next.value };
}

describe("getEStepperStepBatches", () => {
  test.each(PROGRAMS)("the batches add up to the steps of the run: %s", async code => {
    for (const stepLimit of [1000, 21, 7, 3]) {
      const whole = await runEStepper(parse(code), code, 3, stepLimit);
      const { batches, end } = await collect(code, stepLimit);
      expect(renumbered(batches.flat())).toEqual(renumbered(whole.steps));
      expect(end.truncated).toBe(whole.truncated);
      expect(end.truncatedBy).toBe(whole.truncatedBy);
    }
  });

  test("a batch has at most STEPS_PER_BATCH steps, and only the last may have fewer", async () => {
    const { batches } = await collect(PROGRAMS[7], 1000);
    expect(batches.length).toBeGreaterThan(2);
    for (const batch of batches.slice(0, -1)) expect(batch.length).toBe(STEPS_PER_BATCH);
  });

  test("the first batch comes before the run has ended", async () => {
    const code = PROGRAMS[7];
    const generator = getEStepperStepBatches(parse(code), code, 3, 1000, undefined, {}, () => {});
    const first = await generator.next();
    expect(first.done).toBe(false);
    expect(first.value).toHaveLength(STEPS_PER_BATCH);
    expect((await generator.next()).done).toBe(false);
  });

  test("a run cut off by the step limit says so, and keeps the step that says why", async () => {
    const { batches, end } = await collect(PROGRAMS[7], 21);
    expect(end).toMatchObject({ truncated: true, truncatedBy: "steps" });
    expect(batches.flat().at(-1)?.markers?.[0]?.explanation).toBe(
      "Maximum number of steps exceeded",
    );
  });

  test("a run that fails in the program ends with the error, not as cut off", async () => {
    const { batches, end } = await collect("1 / 0\n", 1000);
    expect(end.truncated).toBe(false);
    expect(end.error).toBeDefined();
    expect(batches.flat().at(-1)?.markers?.[0]?.explanation).toBe("Evaluation stuck");
  });

  test("a term too deep to send ends the run there, with a RecursionError, as sendableSteps ends it whole", async () => {
    const whole = (await runEStepper(parse(DEEP), DEEP, 3, 1000)).steps;
    for (const limit of [30, 60, 100]) {
      const post = postUpTo(limit);
      const expected = sendableSteps(whole, post);
      expect(expected.length).toBeLessThan(whole.length); // (the limit does cut this run)
      const { batches, end } = await collect(DEEP, 1000, post);
      expect(renumbered(batches.flat())).toEqual(renumbered(expected));
      expect(end.error).toBe(RECURSION_ERROR_MESSAGE);
    }
  });

  test("what is sent can be copied, and is numbered by its position", async () => {
    const post = postUpTo(60);
    const { batches } = await collect(DEEP, 1000, post);
    const sent = batches.flat();
    expect(sent.map(step => step.cse?.stepIndex)).toEqual(sent.map((_, i) => i));
    for (const step of sent) expect(() => post({ steps: [step] })).not.toThrow();
  });

  test("a run whose first step cannot be sent fails with the RecursionError", async () => {
    await expect(collect("1 + 2\n", 1000, postUpTo(1))).rejects.toThrow(RECURSION_ERROR_MESSAGE);
  });

  test("the machine is not run on after the steps stopped being sendable", async () => {
    let made = 0;
    const post = (message: unknown): void => {
      made++;
      postUpTo(40)(message);
    };
    const { batches } = await collect(DEEP, 100000, post);
    // The run was far longer than what was sent: it was ended at the cut, not run to its end.
    expect(batches.flat().length).toBeLessThan(200);
    expect(made).toBeGreaterThan(0);
  });
});

describe("SendGuard", () => {
  const step = (depth: number): Step => {
    const nested = (d: number): object =>
      d === 0 ? { type: "Identifier" } : { type: "Unary", argument: nested(d - 1) };
    return { ast: nested(depth), markers: [], cse: { stepIndex: 0 } } as unknown as Step;
  };

  test("a batch that can be sent is admitted whole, trying only its deepest step", () => {
    const tried: number[] = [];
    const guard = new SendGuard(message => {
      tried.push(depthOf(message));
      postUpTo(100)(message);
    });
    expect(guard.admit([5, 9, 7, 20, 3].map(step))).toBe(5);
    expect(tried).toHaveLength(1);
  });

  test("a batch no deeper than one already sent needs no try", () => {
    const tried: number[] = [];
    const guard = new SendGuard(message => {
      tried.push(depthOf(message));
      postUpTo(100)(message);
    });
    guard.admit([5, 30].map(step));
    tried.length = 0;
    expect(guard.admit([6, 29, 30, 2].map(step))).toBe(4);
    expect(tried).toEqual([]);
  });

  test("a batch is cut at the first step that is too deep", () => {
    const guard = new SendGuard(postUpTo(25));
    expect(guard.admit([3, 8, 12, 40, 50, 6].map(step))).toBe(3);
  });

  test("what was found too deep is remembered across batches", () => {
    const guard = new SendGuard(postUpTo(25));
    expect(guard.admit([3, 8].map(step))).toBe(2);
    expect(guard.admit([12, 20, 40].map(step))).toBe(2);
  });

  test("the depth that fits is found by halving the depths", () => {
    let tries = 0;
    const guard = new SendGuard(message => {
      tries++;
      postUpTo(150)(message);
    });
    const batch = Array.from({ length: 100 }, (_, i) => step(i * 3));
    const fit = guard.admit(batch);
    expect(fit).toBeLessThan(100);
    expect(fit).toBeGreaterThan(40);
    expect(tries).toBeLessThanOrEqual(9);
  });

  test("a failure of the copy that is not an overflow is left to the send", () => {
    const guard = new SendGuard(() => {
      throw new DOMException("A value could not be cloned.", "DataCloneError");
    });
    expect(guard.admit([3, 30].map(step))).toBe(2);
  });

  test("an empty batch is admitted", () => {
    expect(new SendGuard(postUpTo(1)).admit([])).toBe(0);
  });
});

class FakeChannel {
  name = "__e_stepper";
  sent: StepperMessage[] = [];
  private subscribers: ((message: StepperMessage) => void)[] = [];
  send(message: StepperMessage) {
    this.sent.push(message);
  }
  emit(message: StepperMessage) {
    this.subscribers.forEach(fn => fn(message));
  }
  subscribe(fn: (message: StepperMessage) => void) {
    this.subscribers.push(fn);
  }
  unsubscribe() {}
  close() {}
}

describe("PyEStepperRunnerPlugin", () => {
  const CODE = PROGRAMS[7];

  function setUp(stepLimit?: number) {
    const channel = new FakeChannel();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plugin = new PyEStepperRunnerPlugin({} as any, [channel as any], 3);
    if (stepLimit !== undefined) plugin.setStepLimit(stepLimit);
    plugin.setSource(CODE);
    return { channel, plugin };
  }

  const received = (messages: StepperMessage[]) =>
    messages.flatMap(message => {
      if (message.type !== "batch") throw new Error(`unexpected ${message.type}`);
      return message.steps;
    });

  test("sends the steps in batches that continue each other, then the end of the trace", async () => {
    const { channel, plugin } = setUp(1000);
    await plugin.sendSteps(parse(CODE));
    let total = 0;
    for (const message of channel.sent.slice(0, -1)) {
      if (message.type !== "batch") throw new Error("not a batch");
      expect(message.index).toBe(total);
      expect(message.end).toBeUndefined();
      total += message.steps.length;
    }
    expect(channel.sent[channel.sent.length - 1]).toMatchObject({
      type: "batch",
      index: total,
      steps: [],
      end: { status: "complete" },
    });
  });

  test("the batches add up to the steps of the run", async () => {
    const { channel, plugin } = setUp(1000);
    await plugin.sendSteps(parse(CODE));
    expect(renumbered(received(channel.sent))).toEqual(
      renumbered((await runEStepper(parse(CODE), CODE, 3, 1000)).steps),
    );
  });

  test("a run cut off by the step limit ends cut off, with the reason", async () => {
    const { channel, plugin } = setUp(21);
    await plugin.sendSteps(parse(CODE));
    expect(channel.sent[channel.sent.length - 1]).toMatchObject({
      end: { status: "cut-off", reason: "the limit of 21 steps was reached" },
    });
  });

  test("a request replays the run as one batch that carries its end", async () => {
    const { channel, plugin } = setUp(21);
    await plugin.sendSteps(parse(CODE));
    const steps = received(channel.sent);
    channel.sent.length = 0;
    channel.emit({ type: "request" });
    expect(channel.sent).toHaveLength(1);
    expect(channel.sent[0]).toMatchObject({
      type: "batch",
      index: 0,
      steps,
      end: { status: "cut-off", reason: "the limit of 21 steps was reached" },
    });
  });

  test("without a limit from the host, the e-stepper's own cap applies", async () => {
    const { channel, plugin } = setUp();
    const forever = "def f(n):\n    return 0 if n == 0 else f(n - 1)\nf(100000)\n";
    plugin.setSource(forever);
    await plugin.sendSteps(parse(forever));
    const steps = received(channel.sent);
    expect(steps.length).toBeGreaterThan(E_STEPPER_STEP_CAP - 5);
    expect(steps.length).toBeLessThanOrEqual(E_STEPPER_STEP_CAP);
  });
});
