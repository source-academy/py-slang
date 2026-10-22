/**
 * Library functions (stream_map, ...) are predefined: the CSE snapshot of a step does not draw the
 * frame of a call of one, nor the function objects it makes (py-slang#619).
 */
import { runEStepper } from "../../conductor/estepper/getSteps";
import { parse } from "../../parser";

test("a call of stream_map leaves no frame and no function object of the library", async () => {
  const code = "x = stream_map(lambda x: 2 * x, pair(1, lambda: None))\n";
  const { steps } = await runEStepper(parse(code), code, 3, 1000);
  for (const step of steps) {
    const frames = step.cse?.environments ?? [];
    expect(frames.map(f => f.name).filter(n => n === "stream_map")).toEqual([]);
    // only the program's own two lambdas are function objects
    const functions = frames.flatMap(f => f.heapObjects ?? []).filter(h => h.label === "function");
    expect(functions.length).toBeLessThanOrEqual(2);
  }
});
