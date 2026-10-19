/**
 * The space the e-stepper's steps use (py-slang#611): a run that makes a frame in every iteration
 * kept all of them in every step, so that 100000 steps crashed the browser tab. Unreachable frames
 * and objects are now limited to the newest few, and a run whose steps still grow too large ends
 * with a step that says so, as at the step limit.
 */
import { MAX_STEPS_SIZE, runEStepper } from "../../conductor/estepper/getSteps";
import { MIN_UNREACHABLE, unreachableLimit } from "../../conductor/estepper/serialize";
import { parse } from "../../parser";

const run = (code: string, chapter: number, stepLimit: number, maxSize?: number) =>
  runEStepper(parse(code), code, chapter, stepLimit, undefined, maxSize);

const FOREVER = "def f(x):\n    return f(x)\nf(4)\n";

describe("unreachable frames and objects", () => {
  test("a loop of calls that makes a frame in each iteration keeps a step the same size", async () => {
    const { steps } = await run(FOREVER, 3, 6000);
    const size = (i: number) => JSON.stringify(steps[i]).length;
    expect(steps).toHaveLength(6000);
    // (once the limit on the unreachable frames is reached)
    expect(size(steps.length - 1)).toBeLessThan(1.2 * size(1500));
    const last = steps[steps.length - 1];
    const unreachable = last.frames.filter(f => f.isGarbage);
    expect(unreachable.length).toBeLessThanOrEqual(unreachableLimit(6000));
    // The frames that are not unreachable are all there.
    expect(last.frames.filter(f => !f.isGarbage).map(f => f.id)).toContain("Global");
    // The newest unreachable frames are the ones kept.
    const numbers = unreachable.map(f => Number(f.id.slice(1)));
    expect(Math.min(...numbers)).toBeGreaterThan(100);
  });

  test("a loop that makes a list in each iteration keeps the newest unreachable lists", async () => {
    const { steps, error } = await run(
      "i = 0\nwhile i < 60:\n    x = [i]\n    i = i + 1\n",
      4,
      10000,
    );
    expect(error).toBeUndefined();
    const last = steps[steps.length - 1];
    expect(last.heap.filter(o => o.isGarbage).length).toBeLessThanOrEqual(unreachableLimit(10000));
    // (and not all of the 60)
    expect(last.heap.filter(o => o.isGarbage).length).toBeGreaterThan(0);
    expect(last.heap.filter(o => !o.isGarbage)).toHaveLength(1);
  });

  test("the limit is lower the more steps are allowed, and the default run loses nothing", () => {
    expect(unreachableLimit(1000)).toBeGreaterThanOrEqual(170);
    expect(unreachableLimit(100000)).toBe(MIN_UNREACHABLE);
    expect(unreachableLimit(10000)).toBeLessThan(unreachableLimit(1000));
  });

  test("every unreachable frame of a default run is kept", async () => {
    const code = "def f(n):\n    return 0 if n == 0 else 1 + f(n - 1)\nf(40)\n";
    const { steps } = await run(code, 3, 1000);
    expect(steps[steps.length - 1].frames.filter(f => f.isGarbage)).toHaveLength(41);
  });

  test("a few unreachable frames are all kept", async () => {
    const { steps } = await run("def f(x):\n    return x\nf(1)\nf(2)\nf(3)\n", 3, 1000);
    const last = steps[steps.length - 1];
    expect(last.frames.filter(f => f.isGarbage)).toHaveLength(3);
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
    expect(JSON.stringify(result.steps).length).toBeLessThan(MAX_STEPS_SIZE / 4);
  });
});
