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

  test("PAIR/ARRAY are rejected at chapter 1", async () => {
    const dh = new GenericDataHandler();
    const rt = makeRt();
    const pair = await dh.pair_make(
      { type: DataType.NUMBER, value: 1 },
      { type: DataType.NUMBER, value: 2 },
    );
    await expect(moduleToPython(rt, dh, pair)).rejects.toThrow(Py2JsRuntimeError);

    const arr = await dh.array_make(DataType.NUMBER, 2);
    await expect(moduleToPython(rt, dh, arr)).rejects.toThrow(Py2JsRuntimeError);
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
