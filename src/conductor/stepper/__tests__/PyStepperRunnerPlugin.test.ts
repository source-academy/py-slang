import type { StepperMessage } from "@sourceacademy/common-stepper";

import { parse } from "../../../parser";
import { STEPPER_STEP_CAP } from "../../runConfig";
import { getPythonSteps, STEPS_PER_BATCH } from "../getSteps";
import { PythonStepperRunnerPlugin } from "../PyStepperRunnerPlugin";

class FakeChannel {
  name = "__stepper";
  sent: StepperMessage[] = [];
  private subscribers: ((message: StepperMessage) => void)[] = [];
  send(message: StepperMessage) {
    this.sent.push(message);
  }
  /** What the host sends to the runner. */
  emit(message: StepperMessage) {
    this.subscribers.forEach(fn => fn(message));
  }
  subscribe(fn: (message: StepperMessage) => void) {
    this.subscribers.push(fn);
  }
  unsubscribe() {}
  close() {}
}

const RECURSION = "def f(n):\n    return 0 if n == 0 else f(n - 1)\nf(30)\n";

function setUp(stepLimit?: number) {
  const channel = new FakeChannel();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugin = new PythonStepperRunnerPlugin({} as any, [channel as any], {}, stepLimit);
  return { channel, plugin };
}

function received(messages: StepperMessage[]) {
  return messages.flatMap(message => {
    if (message.type !== "batch") throw new Error(`unexpected ${message.type}`);
    return message.steps;
  });
}

describe("PythonStepperRunnerPlugin", () => {
  test("sends the steps in batches that continue each other, then the end of the trace", async () => {
    const { channel, plugin } = setUp(1000);
    await plugin.sendSteps(parse(RECURSION));
    const messages = channel.sent;
    expect(messages.length).toBeGreaterThan(2);
    let total = 0;
    for (const message of messages.slice(0, -1)) {
      if (message.type !== "batch") throw new Error("not a batch");
      expect(message.index).toBe(total);
      expect(message.end).toBeUndefined();
      expect(message.steps.length).toBeLessThanOrEqual(STEPS_PER_BATCH);
      total += message.steps.length;
    }
    expect(messages[messages.length - 1]).toMatchObject({
      type: "batch",
      index: total,
      steps: [],
      end: { status: "complete" },
    });
  });

  test("the batches add up to the steps that getPythonSteps gives", async () => {
    const { channel, plugin } = setUp(1000);
    await plugin.sendSteps(parse(RECURSION));
    expect(received(channel.sent)).toEqual(await getPythonSteps(parse(RECURSION), 1000));
  });

  test("the syntax profile goes with the first batch only", async () => {
    const { channel, plugin } = setUp(1000);
    await plugin.sendSteps(parse(RECURSION));
    const profiles = channel.sent.map(m => m.type === "batch" && m.profile !== undefined);
    expect(profiles[0]).toBe(true);
    expect(profiles.slice(1).every(p => p === false)).toBe(true);
  });

  test("a run cut off by the step limit ends cut off, with the reason", async () => {
    const { channel, plugin } = setUp(21);
    await plugin.sendSteps(parse(RECURSION));
    expect(channel.sent[channel.sent.length - 1]).toMatchObject({
      type: "batch",
      steps: [],
      end: { status: "cut-off", reason: "the limit of 21 steps was reached" },
    });
  });

  test("a request replays the run as one batch that carries its end", async () => {
    const { channel, plugin } = setUp(21);
    await plugin.sendSteps(parse(RECURSION));
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

  test("without a limit from the host, the stepper's own cap applies", async () => {
    const { channel, plugin } = setUp();
    await plugin.sendSteps(parse("def f(n):\n    return 0 if n == 0 else f(n - 1)\nf(100000)\n"));
    const steps = received(channel.sent);
    expect(steps.length).toBeGreaterThan(STEPPER_STEP_CAP - 5);
    expect(steps.length).toBeLessThanOrEqual(STEPPER_STEP_CAP);
    expect(channel.sent[channel.sent.length - 1]).toMatchObject({
      end: { status: "cut-off", reason: `the limit of ${STEPPER_STEP_CAP} steps was reached` },
    });
  });
});
