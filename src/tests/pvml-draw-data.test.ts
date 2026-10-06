/**
 * draw_data on the PVML-in-browser evaluators (py-slang#490): a running program's draw_data(...) call
 * reaches the data visualizer plugin's sendDrawing, via a mock conductor whose registerPlugin hands
 * back a fake plugin for PvmlDataVisualizerRunnerPlugin. PyPvmlEvaluator.test.ts's mock returns no
 * plugin at all, covering the "none attached" case (draw_data stays the identity).
 */
import { DATA_VISUALIZER_DIRECTORY_ID } from "@sourceacademy/common-data-visualizer";
import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";

import { PvmlDataVisualizerRunnerPlugin } from "../conductor/dataVisualizer/PvmlDataVisualizerRunnerPlugin";
import { PyPvmlEvaluator1, PyPvmlEvaluator2, PyPvmlEvaluator3 } from "../conductor/PyPvmlEvaluator";
import type { PVMLArray, PVMLBoxType } from "../engines/pvml/types";

function makeMockConductor() {
  const rows: PVMLBoxType[][] = [];
  const errors: unknown[] = [];
  const outputs: string[] = [];
  const loaded: string[] = [];
  let resets = 0;
  const plugin = {
    sendDrawing: (values: PVMLBoxType[]) => rows.push(values),
    resetRun: () => {
      resets++;
    },
  };
  const conductor = {
    sendResult: () => undefined,
    sendError: (e: unknown) => errors.push(e),
    sendOutput: (m: string) => outputs.push(m),
    registerPlugin: (cls: unknown) => (cls === PvmlDataVisualizerRunnerPlugin ? plugin : undefined),
    hostLoadPlugin: (id: string) => {
      loaded.push(id);
      return Promise.resolve();
    },
  } as unknown as IRunnerPlugin;
  return { conductor, rows, errors, outputs, loaded, resets: () => resets };
}

test("§2+ host-loads the data visualizer; §1 does not", () => {
  const two = makeMockConductor();
  new PyPvmlEvaluator2(two.conductor);
  expect(two.loaded).toContain(DATA_VISUALIZER_DIRECTORY_ID);

  const one = makeMockConductor();
  new PyPvmlEvaluator1(one.conductor);
  expect(one.loaded).not.toContain(DATA_VISUALIZER_DIRECTORY_ID);
});

test("draw_data sends its arguments to the plugin and returns its first argument", async () => {
  const { conductor, rows, errors, outputs } = makeMockConductor();
  const evaluator = new PyPvmlEvaluator3(conductor); // §3 for `is`

  await evaluator.evaluateChunk("p = pair(1, 2)\nprint(draw_data(p, 3) is p)\n");

  expect(errors).toEqual([]);
  expect(outputs).toEqual(["True"]);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toEqual([{ type: "array", elements: [1n, 2n] }, 3n]);
});

test("each draw_data call is its own drawing, and each chunk resets the run", async () => {
  const { conductor, rows, errors, resets } = makeMockConductor();
  const evaluator = new PyPvmlEvaluator2(conductor);

  await evaluator.evaluateChunk("draw_data(1)\ndraw_data(2)\n");
  await evaluator.evaluateChunk("draw_data(3)\n");

  expect(errors).toEqual([]);
  expect(rows).toEqual([[1n], [2n], [3n]]);
  expect(resets()).toBe(2);
});

test("a cyclic structure is passed through unchanged (cycle handling is the plugin's)", async () => {
  const { conductor, rows, errors } = makeMockConductor();
  const evaluator = new PyPvmlEvaluator3(conductor);

  await evaluator.evaluateChunk("x = pair(1, None)\nset_tail(x, x)\ndraw_data(x)\n");

  expect(errors).toEqual([]);
  const first = rows[0][0] as PVMLArray;
  expect(first.elements[1]).toBe(first);
});
