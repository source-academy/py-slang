/**
 * The space the e-stepper's steps use (py-slang#611): every step held every frame the program had
 * ever made, so that a loop that makes a frame in each iteration made steps of ever larger size
 * (100000 steps crashed the browser tab). What is unreachable stays so, so a frame or an object is
 * in the step where it becomes unreachable and in no step after it; a host takes the earlier ones
 * from the earlier steps (`storeAt`). A run whose steps still grow too large ends with a step that
 * says so, as at the step limit.
 */
import { MAX_STEPS_SIZE, runEStepper } from "../../conductor/estepper/getSteps";
import { unreachableLimit } from "../../conductor/estepper/serialize";
import { parse } from "../../parser";
import { storeAt, withStore } from "./store";

const run = (code: string, chapter: number, stepLimit: number, maxSize?: number) =>
  runEStepper(parse(code), code, chapter, stepLimit, undefined, maxSize);

const FOREVER = "def f(x):\n    return f(x)\nf(4)\n";
const LISTS = "i = 0\nwhile i < 60:\n    x = [i]\n    i = i + 1\n";

describe("unreachable frames and objects", () => {
  test("a loop of calls that makes a frame in each iteration keeps a step the same size", async () => {
    const { steps } = await run(FOREVER, 3, 6000);
    const size = (i: number) => JSON.stringify(steps[i]).length;
    expect(steps).toHaveLength(6000);
    expect(size(steps.length - 1)).toBeLessThan(1.2 * size(1500));
    expect(size(1500)).toBeLessThan(1.2 * size(100));
  });

  test("nothing is lost: all the unreachable frames are in the whole store", async () => {
    const { steps } = await run(FOREVER, 3, 6000);
    const whole = withStore(steps);
    const unreachable = whole.frames.filter(f => f.isGarbage);
    // One frame is made in each iteration (and each takes six steps).
    expect(unreachable.length).toBeGreaterThan(900);
    expect(whole.frames.filter(f => !f.isGarbage).map(f => f.id)).toContain("Global");
    expect(unreachable.map(f => f.id)).toContain("E1");
  });

  test("each unreachable frame and object is in exactly one step", async () => {
    for (const [code, chapter] of [
      [FOREVER, 3],
      [LISTS, 4],
      [
        "def g(n):\n    return lambda y: y + n\ni = 0\nwhile i < 30:\n    h = g(i)\n    i = i + 1\n",
        4,
      ],
    ] as const) {
      const { steps } = await run(code, chapter, 4000);
      const seen = new Map<string, number>();
      for (const step of steps) {
        for (const item of [...step.frames, ...step.heap]) {
          if (item.isGarbage) seen.set(item.id, (seen.get(item.id) ?? 0) + 1);
        }
      }
      expect(seen.size).toBeGreaterThan(0);
      expect([...seen.values()].every(n => n === 1)).toBe(true);
    }
  });

  test("a loop that makes a list in each iteration: all the lists are in the whole store", async () => {
    const { steps, error } = await run(LISTS, 4, 10000);
    expect(error).toBeUndefined();
    const { heap } = storeAt(steps, steps.length - 1);
    expect(heap.filter(o => o.isGarbage)).toHaveLength(59);
    expect(heap.filter(o => !o.isGarbage)).toHaveLength(1);
  });

  test("an unreachable frame stays after later steps", async () => {
    const { steps } = await run("def f(x):\n    return x\nf(1)\nf(2)\nf(3)\n", 3, 1000);
    expect(storeAt(steps, steps.length - 1).frames.filter(f => f.isGarbage)).toHaveLength(3);
    // Not yet in the first step in which f(1) has returned, and then the first of them only.
    const firstIndex = steps.findIndex(s => s.frames.some(f => f.isGarbage));
    expect(storeAt(steps, firstIndex).frames.filter(f => f.isGarbage)).toHaveLength(1);
    expect(storeAt(steps, firstIndex - 1).frames.filter(f => f.isGarbage)).toHaveLength(0);
  });

  test("the CSE snapshot holds the newest unreachable objects that no frame holds", async () => {
    const stepLimit = 10000;
    const { steps } = await run(LISTS, 4, stepLimit);
    const last = steps[steps.length - 1];
    const objects = last.cse.environments.flatMap(
      (f: { heapObjects?: unknown[] }) => f.heapObjects ?? [],
    );
    expect(objects.length).toBeLessThanOrEqual(unreachableLimit(stepLimit));
    expect(objects.length).toBeGreaterThan(0);
  });

  test("the limit is lower the more steps are allowed, and the default run loses nothing", () => {
    expect(unreachableLimit(1000)).toBeGreaterThanOrEqual(170);
    expect(unreachableLimit(100000)).toBe(10);
    expect(unreachableLimit(10000)).toBeLessThan(unreachableLimit(1000));
  });
});

describe("the limit on the size of the steps", () => {
  test("ends the run with a step that says so", async () => {
    const result = await run(FOREVER, 3, 100000, 200_000);
    expect(result.truncated).toBe(true);
    expect(result.truncatedBy).toBe("size");
    expect(result.error).toBeUndefined();
    expect(result.steps.length).toBeLessThan(1000);
    expect(result.steps[result.steps.length - 1].markers?.[0]?.explanation).toMatch(
      /^Maximum size of the steps exceeded/,
    );
  });

  test("is not reached by a run of the default step limit", async () => {
    const result = await run(FOREVER, 3, 1000);
    expect(result.truncatedBy).toBe("steps");
    expect(JSON.stringify(result.steps).length).toBeLessThan(MAX_STEPS_SIZE / 10);
  });
});
