/**
 * draw_data (chapter 2+, bridged natively as part of the LINKED_LISTS group — see
 * stdlibBridge.ts's nativeDrawData): exercises the actual wiring from a running program's
 * draw_data(...) call through to a data visualizer plugin's sendDrawing, via a fake plugin passed
 * straight into Py2JsSession (bypassing the full Conductor registration machinery, which
 * Py2JsEvaluator.test.ts's mock conductor stubs out entirely). Py2JsEvaluator.test.ts covers the
 * complementary "no plugin attached" case.
 */
import type { BaseDataVisualizerRunnerPlugin } from "@sourceacademy/runner-data-visualizer";
import { Py2JsSession, type PyValue } from "../engines/py2js";

function makeFakePlugin() {
  const rows: PyValue[][] = [];
  const plugin = {
    sendDrawing: (values: PyValue[]) => rows.push(values),
    resetRun: () => undefined,
  } as unknown as BaseDataVisualizerRunnerPlugin<PyValue>;
  return { plugin, rows };
}

test("draw_data forwards its arguments to the data visualizer plugin's sendDrawing, unconverted", async () => {
  const { plugin, rows } = makeFakePlugin();
  const session = new Py2JsSession(2, { dataVisualizer: plugin });

  await session.runChunk("draw_data(1, pair(2, 3))\n");

  expect(rows).toHaveLength(1);
  expect(rows[0]).toEqual([1n, [2n, 3n]]);
});

test("multiple draw_data calls each produce their own sendDrawing call", async () => {
  const { plugin, rows } = makeFakePlugin();
  const session = new Py2JsSession(2, { dataVisualizer: plugin });

  await session.runChunk("draw_data(1, 2)\ndraw_data(3, 4)\n");

  expect(rows).toEqual([
    [1n, 2n],
    [3n, 4n],
  ]);
});

test("a self-referential pair passed to draw_data does not hang the bridge", async () => {
  const { plugin, rows } = makeFakePlugin();
  const session = new Py2JsSession(3, { dataVisualizer: plugin });

  await session.runChunk("x = [1, None]\nset_tail(x, x)\ndraw_data(x, 2)\n");

  expect(rows).toHaveLength(1);
  const [first] = rows[0];
  if (!Array.isArray(first)) throw new Error("expected an array");
  expect(first[1]).toBe(first);
});
