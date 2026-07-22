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
import {
  DataType,
  ExternCallable,
  PairIdentifier,
  TypedValue,
} from "@sourceacademy/conductor/types";
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

/**
 * The generic list helpers (list/is_list/list_to_vec/accumulate/length) had
 * no direct test before this: moduleInterop.ts and the module-interop test
 * suite exercise pair_make/pair_head/pair_tail (via pythonToModule's PAIR
 * case) but never a conductor module's own generic list operations. These
 * walk the same pair-chain structure `is_list`/`length`/`map`/`filter` walk
 * in py2js's own runtime.ts and stdlibBridge.ts, and are covered by the same
 * no-cycle-detection stance ([[feedback-no-cycle-detection-in-list-primitives]]
 * — a circular list should hang here too, not error).
 */
const num = (value: number): TypedValue<DataType.NUMBER> => ({ type: DataType.NUMBER, value });

async function drain<T>(gen: AsyncGenerator<void, T, undefined>): Promise<T> {
  let step = await gen.next();
  while (!step.done) step = await gen.next();
  return step.value;
}

function makeAddClosure(): ExternCallable<[DataType.NUMBER, DataType.NUMBER], DataType.NUMBER> {
  return async function* (a: TypedValue<DataType.NUMBER>, b: TypedValue<DataType.NUMBER>) {
    await Promise.resolve();
    return num(a.value + b.value);
  };
}

describe("list()/is_list/list_to_vec/length/accumulate — the generic pair-chain list helpers", () => {
  test("list() builds a proper pair-chain, and is_list recognizes it", async () => {
    const dh = new GenericDataHandler();
    const xs = await dh.list(num(1), num(2), num(3));
    expect(await dh.is_list(xs)).toBe(true);
  });

  test("is_list is false for a non-pair, non-empty-list value", async () => {
    const dh = new GenericDataHandler();
    expect(await dh.is_list(num(42) as unknown as TypedValue<DataType.LIST>)).toBe(false);
  });

  test("is_list is false for an improper pair (tail isn't nil or another pair)", async () => {
    const dh = new GenericDataHandler();
    const improper = await dh.pair_make(num(1), num(2));
    expect(await dh.is_list(improper as unknown as TypedValue<DataType.LIST>)).toBe(false);
  });

  test("is_list is false for a dangling/invalid pair identifier", async () => {
    const dh = new GenericDataHandler();
    const bogus: TypedValue<DataType.PAIR> = {
      type: DataType.PAIR,
      value: 9999 as unknown as PairIdentifier,
    };
    expect(await dh.is_list(bogus as unknown as TypedValue<DataType.LIST>)).toBe(false);
  });

  test("list_to_vec round-trips list()'s elements back out, in order", async () => {
    const dh = new GenericDataHandler();
    const xs = await dh.list(num(1), num(2), num(3));
    expect(await dh.list_to_vec(xs)).toEqual([num(1), num(2), num(3)]);
  });

  test("list_to_vec rejects a non-list value", async () => {
    const dh = new GenericDataHandler();
    await expect(dh.list_to_vec(num(42) as unknown as TypedValue<DataType.LIST>)).rejects.toThrow(
      /Expected a list, got type/,
    );
  });

  test("list_to_vec rejects a dangling/invalid pair identifier", async () => {
    const dh = new GenericDataHandler();
    const bogus: TypedValue<DataType.PAIR> = {
      type: DataType.PAIR,
      value: 9999 as unknown as PairIdentifier,
    };
    await expect(dh.list_to_vec(bogus as unknown as TypedValue<DataType.LIST>)).rejects.toThrow(
      /Invalid pair identifier/,
    );
  });

  test("length counts list()'s elements", async () => {
    const dh = new GenericDataHandler();
    const xs = await dh.list(num(1), num(2), num(3), num(4));
    expect(await dh.length(xs)).toBe(4);
  });

  test("length throws on a non-list value", () => {
    const dh = new GenericDataHandler();
    expect(() => dh.length(num(42) as unknown as TypedValue<DataType.LIST>)).toThrow(
      /Expected a list, got type/,
    );
  });

  test("length throws on a dangling/invalid pair identifier", () => {
    const dh = new GenericDataHandler();
    const bogus: TypedValue<DataType.PAIR> = {
      type: DataType.PAIR,
      value: 9999 as unknown as PairIdentifier,
    };
    expect(() => dh.length(bogus as unknown as TypedValue<DataType.LIST>)).toThrow(
      /Invalid pair identifier/,
    );
  });

  test("accumulate reduces a list left-to-right through a closure", async () => {
    const dh = new GenericDataHandler();
    const add = makeAddClosure();
    const op = await dh.closure_make(
      { args: [DataType.NUMBER, DataType.NUMBER], returnType: DataType.NUMBER },
      add,
    );
    const xs = await dh.list(num(1), num(2), num(3));

    const result = await drain(dh.accumulate(op, num(0), xs, DataType.NUMBER));

    expect(result).toEqual(num(6));
  });

  test("accumulate on an empty list returns the initial value untouched", async () => {
    const dh = new GenericDataHandler();
    const add = makeAddClosure();
    const op = await dh.closure_make(
      { args: [DataType.NUMBER, DataType.NUMBER], returnType: DataType.NUMBER },
      add,
    );
    const empty = await dh.list();

    const result = await drain(dh.accumulate(op, num(0), empty, DataType.NUMBER));

    expect(result).toEqual(num(0));
  });

  test("accumulate rejects a malformed (non-list) sequence", async () => {
    const dh = new GenericDataHandler();
    const add = makeAddClosure();
    const op = await dh.closure_make(
      { args: [DataType.NUMBER, DataType.NUMBER], returnType: DataType.NUMBER },
      add,
    );

    const gen = dh.accumulate(
      op,
      num(0),
      num(42) as unknown as TypedValue<DataType.LIST>,
      DataType.NUMBER,
    );

    await expect(gen.next()).rejects.toThrow(/Expected a list, got type/);
  });
});

/**
 * Per Martin: a pair is just a 2-element array, not a distinct concept. These pin down the two
 * bridges that make that true without requiring any module to change: pair_head/pair_tail (etc.)
 * work on an ARRAY-tagged value the same as a genuine PAIR, and the generic list helpers
 * (is_list/list_to_vec/length/accumulate) accept ARRAY directly instead of only recognizing a
 * PAIR/EMPTY_LIST chain.
 */
describe("PAIR and ARRAY are interchangeable, per Martin's 'pair is just a 2-element array'", () => {
  test("pair_head/pair_tail read an ARRAY-tagged value's first two elements", async () => {
    const dh = new GenericDataHandler();
    const arr = await dh.array_make(DataType.NUMBER, 2, num(0));
    await dh.array_set(arr as unknown as TypedValue<DataType.ARRAY, DataType.VOID>, 0, num(1));
    await dh.array_set(arr as unknown as TypedValue<DataType.ARRAY, DataType.VOID>, 1, num(2));
    const asPair = arr as unknown as TypedValue<DataType.PAIR>;

    expect(await dh.pair_head(asPair)).toEqual(num(1));
    expect(await dh.pair_tail(asPair)).toEqual(num(2));
  });

  test("pair_sethead/pair_settail write back into the underlying array", async () => {
    const dh = new GenericDataHandler();
    const arr = await dh.array_make(DataType.NUMBER, 2, num(0));
    const asPair = arr as unknown as TypedValue<DataType.PAIR>;

    await dh.pair_sethead(asPair, num(9));
    await dh.pair_settail(asPair, num(8));

    expect(await dh.array_get(arr, 0)).toEqual(num(9));
    expect(await dh.array_get(arr, 1)).toEqual(num(8));
  });

  test("pair_assert checks an ARRAY-tagged value's element types the same as a genuine PAIR", async () => {
    const dh = new GenericDataHandler();
    const arr = await dh.array_make(DataType.NUMBER, 2, num(0));
    const asPair = arr as unknown as TypedValue<DataType.PAIR>;

    await expect(dh.pair_assert(asPair, DataType.NUMBER, DataType.NUMBER)).resolves.toBeUndefined();
    expect(() => dh.pair_assert(asPair, DataType.CONST_STRING)).toThrow(/Expected head of type/);
  });

  test("pair_head throws on a too-short array (fewer than 2 elements), same as a dangling pair", async () => {
    const dh = new GenericDataHandler();
    const arr = await dh.array_make(DataType.NUMBER, 1, num(0));
    expect(() => dh.pair_head(arr as unknown as TypedValue<DataType.PAIR>)).toThrow(
      /Invalid pair identifier/,
    );
  });

  test("is_list/list_to_vec/length/accumulate accept a DataType.ARRAY directly", async () => {
    const dh = new GenericDataHandler();
    const arr = await dh.array_make(DataType.NUMBER, 3, num(0));
    await dh.array_set(arr as unknown as TypedValue<DataType.ARRAY, DataType.VOID>, 0, num(1));
    await dh.array_set(arr as unknown as TypedValue<DataType.ARRAY, DataType.VOID>, 1, num(2));
    await dh.array_set(arr as unknown as TypedValue<DataType.ARRAY, DataType.VOID>, 2, num(3));
    const asList = arr as unknown as TypedValue<DataType.LIST>;

    expect(await dh.is_list(asList)).toBe(true);
    expect(await dh.list_to_vec(asList)).toEqual([num(1), num(2), num(3)]);
    expect(await dh.length(asList)).toBe(3);

    const add = makeAddClosure();
    const op = await dh.closure_make(
      { args: [DataType.NUMBER, DataType.NUMBER], returnType: DataType.NUMBER },
      add,
    );
    const result = await drain(dh.accumulate(op, num(0), asList, DataType.NUMBER));
    expect(result).toEqual(num(6));
  });
});
