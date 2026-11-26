import type { SerializedStepperStep } from "@sourceacademy/common-stepper";

import { parse } from "../../../parser";
import { getPythonStepBatches, getPythonSteps, STEPS_PER_BATCH } from "../getSteps";

const PROGRAMS: string[] = [
  "1 + 2 * 3",
  "x = 1\ny = x + 1\ny * 2",
  "def f(x):\n    return x + 1\nf(2)",
  "def fact(n):\n    return 1 if n == 0 else n * fact(n - 1)\nfact(6)",
  "print(1 + 1)\nprint(2)",
  "1 / 0",
  "def f(n):\n    return 0 if n == 0 else f(n - 1)\nf(200)",
  "g = lambda x: x * 2\ng(g(3))",
  "def f(a):\n    return a\nf(f(f(1)))",
  "if True:\n    z = 1\nelse:\n    z = 2\nz",
];

async function collect(source: string, stepLimit: number) {
  const generator = getPythonStepBatches(parse(source + "\n"), stepLimit);
  const batches: SerializedStepperStep[][] = [];
  let next = await generator.next();
  for (; !next.done; next = await generator.next()) batches.push(next.value);
  return { batches, end: next.value };
}

describe("getPythonStepBatches", () => {
  test.each(PROGRAMS)("the batches add up to the steps of getPythonSteps: %s", async source => {
    for (const stepLimit of [1000, 21, 7, 3, 1, 0]) {
      const whole = await getPythonSteps(parse(source + "\n"), stepLimit);
      const { batches } = await collect(source, stepLimit);
      expect(batches.flat()).toEqual(whole);
    }
  });

  test("a batch has at most STEPS_PER_BATCH steps, and only the last may have fewer", async () => {
    const { batches } = await collect(PROGRAMS[6], 1000);
    expect(batches.length).toBeGreaterThan(2);
    for (const batch of batches.slice(0, -1)) expect(batch.length).toBe(STEPS_PER_BATCH);
    expect(batches[batches.length - 1].length).toBeLessThanOrEqual(STEPS_PER_BATCH);
  });

  test("says that the run was cut off by the step limit, and only if it was", async () => {
    const long = "def f(n):\n    return 0 if n == 0 else f(n - 1)\nf(200)";
    expect((await collect(long, 21)).end).toEqual({ limitReached: true });
    expect((await collect("1 + 2 * 3", 1000)).end).toEqual({ limitReached: false });
    expect((await collect("1 / 0", 1000)).end).toEqual({ limitReached: false });
  });

  test("a run cut off by the limit keeps its last step, which says so", async () => {
    const long = "def f(n):\n    return 0 if n == 0 else f(n - 1)\nf(200)";
    const { batches } = await collect(long, 21);
    const last = batches.flat().at(-1);
    expect(last?.markers?.[0]?.explanation).toBe("Maximum number of steps exceeded");
  });

  test("the first batch is there before the program has been stepped to its end", async () => {
    const generator = getPythonStepBatches(parse(PROGRAMS[6] + "\n"), 1000);
    const first = await generator.next();
    expect(first.done).toBe(false);
    expect(first.value).toHaveLength(STEPS_PER_BATCH);
    // And the program was not run to its end for it: this run has far more steps to come.
    const rest = await generator.next();
    expect(rest.done).toBe(false);
  });
});
