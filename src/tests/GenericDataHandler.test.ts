/**
 * asInterfacableEvaluator combines an IEvaluator and a GenericDataHandler
 * into the single object ModuleLoaderRunnerPlugin's constructor requires,
 * via a Proxy. Nothing exercised this directly before: moduleInterop.ts and
 * PyCseEvaluatorBase's own module-interop code call the GenericDataHandler
 * instance straight, bypassing the proxy entirely, so a naive
 * `Reflect.get(dataHandler, prop, dataHandler)` (unbound) would look correct
 * in every existing test while still being broken for the one caller that
 * actually goes through the proxy: conductor's ModuleLoaderRunnerPlugin
 * itself. Unbound, `this` inside a proxied call is the proxy; stateful
 * writes like `this.uniqueId++` in pair_make/array_make/closure_make/
 * opaque_make then land on the proxy's target (the evaluator) instead of
 * dataHandler, so every allocation through the proxy would read back
 * uniqueId 0 forever and collide on the same identifier.
 */
import type { IEvaluator } from "@sourceacademy/conductor/runner";
import { DataType } from "@sourceacademy/conductor/types";
import { asInterfacableEvaluator, GenericDataHandler } from "../conductor/GenericDataHandler";

function fakeEvaluator(): IEvaluator {
  return { startEvaluator: () => Promise.resolve(undefined) };
}

test("repeated allocations through the proxy get distinct ids and land in dataHandler", async () => {
  const dataHandler = new GenericDataHandler();
  const proxied = asInterfacableEvaluator(fakeEvaluator(), dataHandler);

  const first = await proxied.pair_make(
    { type: DataType.NUMBER, value: 1 },
    { type: DataType.NUMBER, value: 2 },
  );
  const second = await proxied.pair_make(
    { type: DataType.NUMBER, value: 3 },
    { type: DataType.NUMBER, value: 4 },
  );

  // The bug this guards against: both allocations silently returning id 0
  // (uniqueId stuck because the write side of `this.uniqueId++` missed
  // dataHandler) and the second pair overwriting the first in pairMap.
  expect(second.value).not.toBe(first.value);

  const firstHead = await proxied.pair_head(first);
  const secondHead = await proxied.pair_head(second);
  expect(firstHead).toEqual({ type: DataType.NUMBER, value: 1 });
  expect(secondHead).toEqual({ type: DataType.NUMBER, value: 3 });

  // Calling through the proxy must mutate the shared dataHandler, not some
  // state stuck on the proxy/evaluator side.
  const direct = await dataHandler.pair_head(first);
  expect(direct).toEqual({ type: DataType.NUMBER, value: 1 });
});

test("non-dataHandler properties still resolve against the underlying evaluator", async () => {
  const evaluator = fakeEvaluator();
  const proxied = asInterfacableEvaluator(evaluator, new GenericDataHandler());
  await expect(proxied.startEvaluator("entry")).resolves.toBeUndefined();
});
