/**
 * Unit tests for py2js's module-interop conversion layer
 * (src/engines/py2js/moduleInterop.ts): pythonToModule/moduleToPython
 * against a real GenericDataHandler (no need for a mock — the handler is
 * fully generic bookkeeping, see conductor/GenericDataHandler.ts), mirroring
 * how src/tests/modules.test.ts exercises the CSE machine's equivalent
 * converters.
 */
import { DataType, TypedValue } from "@sourceacademy/conductor/types";
import { GenericDataHandler } from "../conductor/GenericDataHandler";
import { moduleToPython, pythonToModule } from "../engines/py2js/moduleInterop";
import { Py2JsRuntime, Py2JsRuntimeError, PyOpaque } from "../engines/py2js/runtime";

function makeRt() {
  return new Py2JsRuntime();
}

describe("pythonToModule", () => {
  test("scalars", async () => {
    const dh = new GenericDataHandler();
    const rt = makeRt();
    expect(await pythonToModule(rt, dh, 5n)).toEqual({ type: DataType.NUMBER, value: 5 });
    expect(await pythonToModule(rt, dh, 2.5)).toEqual({ type: DataType.NUMBER, value: 2.5 });
    expect(await pythonToModule(rt, dh, true)).toEqual({ type: DataType.BOOLEAN, value: true });
    expect(await pythonToModule(rt, dh, "hi")).toEqual({
      type: DataType.CONST_STRING,
      value: "hi",
    });
    expect(await pythonToModule(rt, dh, null)).toEqual({ type: DataType.EMPTY_LIST, value: null });
  });

  test("a PyOpaque round-trips back to its original typed value", async () => {
    const dh = new GenericDataHandler();
    const rt = makeRt();
    const typed = await dh.opaque_make({ some: "handle" });
    const opaque = new PyOpaque(typed);
    expect(await pythonToModule(rt, dh, opaque)).toBe(typed);
  });

  test("complex values are rejected", async () => {
    const dh = new GenericDataHandler();
    const rt = makeRt();
    const { PyComplexNumber } = await import("../types");
    await expect(pythonToModule(rt, dh, new PyComplexNumber(1, 2))).rejects.toThrow(
      Py2JsRuntimeError,
    );
  });

  test("a Python function becomes a callable CLOSURE a module can invoke", async () => {
    const dh = new GenericDataHandler();
    const rt = makeRt();
    // Conductor's NUMBER always maps to py2js's native `number` (float) —
    // module signatures only know NUMBER, same convention as every engine's
    // converter (see the file header).
    const double = rt.def("double", 1, (x: unknown) => (x as number) * 2);
    const typed = await pythonToModule(rt, dh, double);
    expect(typed.type).toBe(DataType.CLOSURE);
    if (typed.type !== DataType.CLOSURE) throw new Error("unreachable");

    // The module's-eye view: call it through conductor's own generic
    // closure protocol (closure_call_unchecked), exactly as a real module
    // would — never touching rt.callSync directly.
    const gen = dh.closure_call_unchecked(typed, [{ type: DataType.NUMBER, value: 21 }]);
    let step = await gen.next();
    while (!step.done) step = await gen.next();
    expect(step.value).toEqual({ type: DataType.NUMBER, value: 42 });
  });

  test("a scalar-in/scalar-out Python function also gets a working closure_call_sync fast path", async () => {
    const dh = new GenericDataHandler();
    const rt = makeRt();
    const double = rt.def("double", 1, (x: unknown) => (x as number) * 2);
    const typed = await pythonToModule(rt, dh, double);
    if (typed.type !== DataType.CLOSURE) throw new Error("unreachable");

    // No await anywhere in this call - if it needed one, this wouldn't compile
    // as a synchronous expression the way the rest of the test does.
    const result = dh.closure_call_sync(typed, [{ type: DataType.NUMBER, value: 21 }]);
    expect(result).toEqual({ type: DataType.NUMBER, value: 42 });
  });

  test("closure_call_sync returns undefined (no sync path) for a closure with no .sync", async () => {
    const dh = new GenericDataHandler();
    async function* noSync(): AsyncGenerator<void, TypedValue<DataType>, undefined> {
      await Promise.resolve();
      return { type: DataType.NUMBER, value: 1 };
    }
    const typed = await dh.closure_make({ returnType: DataType.NUMBER, args: [] }, noSync);
    expect(dh.closure_call_sync(typed, [])).toBeUndefined();
  });

  test("closure_call_sync calls the underlying Python function exactly once, even when it throws on a non-scalar result", async () => {
    const dh = new GenericDataHandler();
    const rt = makeRt();
    let callCount = 0;
    // Returns a pair (a 2-element PyList) - not representable by the sync
    // fast path's restricted converter (moduleToPythonSync/pythonToModuleSync
    // only cover scalars). Once rt.callSync has actually run (incrementing
    // callCount), falling back to "no sync path" would silently call this a
    // second time - the fix must throw instead, and must never invoke the
    // function twice.
    const makesAPair = rt.def("makesAPair", 0, () => {
      callCount += 1;
      return [1, 2];
    });
    const typed = await pythonToModule(rt, dh, makesAPair);
    if (typed.type !== DataType.CLOSURE) throw new Error("unreachable");

    expect(() => dh.closure_call_sync(typed, [])).toThrow(Py2JsRuntimeError);
    expect(callCount).toBe(1);
  });
});

describe("moduleToPython", () => {
  test("scalars", async () => {
    const dh = new GenericDataHandler();
    const rt = makeRt();
    expect(await moduleToPython(rt, dh, { type: DataType.NUMBER, value: 5 })).toBe(5);
    expect(await moduleToPython(rt, dh, { type: DataType.BOOLEAN, value: false })).toBe(false);
    expect(await moduleToPython(rt, dh, { type: DataType.CONST_STRING, value: "x" })).toBe("x");
    expect(await moduleToPython(rt, dh, { type: DataType.EMPTY_LIST, value: null })).toBeNull();
    expect(await moduleToPython(rt, dh, { type: DataType.VOID, value: undefined })).toBeNull();
  });

  test("OPAQUE becomes a PyOpaque wrapper", async () => {
    const dh = new GenericDataHandler();
    const rt = makeRt();
    const typed = await dh.opaque_make("payload");
    const result = await moduleToPython(rt, dh, typed);
    expect(result).toBeInstanceOf(PyOpaque);
    expect((result as PyOpaque).typed).toBe(typed);
  });

  test("PAIR round-trips through a 2-element PyList", async () => {
    const dh = new GenericDataHandler();
    const rt = makeRt();
    const pair = await dh.pair_make(
      { type: DataType.NUMBER, value: 1 },
      { type: DataType.NUMBER, value: 2 },
    );
    const native = await moduleToPython(rt, dh, pair);
    expect(Array.isArray(native)).toBe(true);
    expect(native).toEqual([1, 2]);

    const roundTripped = await pythonToModule(rt, dh, native);
    expect(roundTripped.type).toBe(DataType.PAIR);
    expect(await dh.pair_head(roundTripped as TypedValue<DataType.PAIR>)).toEqual({
      type: DataType.NUMBER,
      value: 1,
    });
    expect(await dh.pair_tail(roundTripped as TypedValue<DataType.PAIR>)).toEqual({
      type: DataType.NUMBER,
      value: 2,
    });
  });

  test("ARRAY converts to a genuine flat PyList, recursively (e.g. scrabble's word lists)", async () => {
    const dh = new GenericDataHandler();
    const rt = makeRt();
    const arr = await dh.array_make(DataType.CONST_STRING, 2);
    await dh.array_set(arr as unknown as TypedValue<DataType.ARRAY, DataType.VOID>, 0, {
      type: DataType.CONST_STRING,
      value: "cat",
    });
    await dh.array_set(arr as unknown as TypedValue<DataType.ARRAY, DataType.VOID>, 1, {
      type: DataType.CONST_STRING,
      value: "dog",
    });

    expect(await moduleToPython(rt, dh, arr)).toEqual(["cat", "dog"]);
  });

  test("a nested ARRAY (array of arrays) converts to a nested PyList", async () => {
    const dh = new GenericDataHandler();
    const rt = makeRt();
    const inner = await dh.array_make(DataType.CONST_STRING, 1);
    await dh.array_set(inner as unknown as TypedValue<DataType.ARRAY, DataType.VOID>, 0, {
      type: DataType.CONST_STRING,
      value: "a",
    });
    const outer = await dh.array_make(DataType.ARRAY, 1, inner);

    expect(await moduleToPython(rt, dh, outer)).toEqual([["a"]]);
  });

  test("a chapter-3 native list literal (not built via pair()) now crosses into a module too", async () => {
    // Before pairs and lists were unified into one PyList representation,
    // pythonToModule's "object" case only recognized PyPair — a genuine
    // [1, 2] literal (typeof "object", but not instanceof PyPair) fell
    // through to the generic "complex values are not supported" error, a
    // misleading message for what was actually just an unhandled list. Once
    // the type check became Array.isArray, a 2-element literal list crosses
    // exactly like a pair() result does — there's no representational
    // difference for pythonToModule to even distinguish them by.
    const dh = new GenericDataHandler();
    const rt = makeRt();
    const typed = await pythonToModule(rt, dh, [10n, 20n]);
    expect(typed.type).toBe(DataType.PAIR);
    expect(await dh.pair_head(typed as TypedValue<DataType.PAIR>)).toEqual({
      type: DataType.NUMBER,
      value: 10,
    });
    expect(await dh.pair_tail(typed as TypedValue<DataType.PAIR>)).toEqual({
      type: DataType.NUMBER,
      value: 20,
    });
  });

  test("an N-element (N != 2) list has no module representation and throws clearly, not silently truncating", async () => {
    const dh = new GenericDataHandler();
    const rt = makeRt();
    await expect(pythonToModule(rt, dh, [1n, 2n, 3n])).rejects.toThrow(/2-element list/);
  });

  test("CLOSURE becomes an asyncOnly PyFunction", async () => {
    const dh = new GenericDataHandler();
    const rt = makeRt();
    async function* addOne(
      x: TypedValue<DataType>,
    ): AsyncGenerator<void, TypedValue<DataType>, undefined> {
      await Promise.resolve(); // conductor's ExternCallable contract requires an async generator
      return { type: DataType.NUMBER, value: (x as TypedValue<DataType.NUMBER>).value + 1 };
    }
    const closure = await dh.closure_make(
      { returnType: DataType.NUMBER, args: [DataType.NUMBER] },
      addOne,
    );
    const fn = await moduleToPython(rt, dh, closure, "add_one");
    expect(typeof fn).toBe("function");
    const f = fn as unknown as { pyName: string; asyncOnly?: boolean };
    expect(f.pyName).toBe("add_one");
    expect(f.asyncOnly).toBe(true);

    // Sync call rejects: this is the guard that makes a hot, synchronously
    // sampled module callback fail loudly instead of misbehaving if it tries
    // to call an imported function that needs a real round-trip.
    expect(() => rt.callSync(fn as never, [4n])).toThrow(/frontend round-trip/);

    // Async call goes through and produces the right value.
    expect(await rt.acall(fn as never, [4n])).toBe(5);
  });
});
