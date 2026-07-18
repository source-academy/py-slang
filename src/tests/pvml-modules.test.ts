import type { IModulePlugin } from "@sourceacademy/conductor/module";
import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { DataType, IDataHandler, TypedValue } from "@sourceacademy/conductor/types";
import { PyPvmlEvaluator1, PyPvmlEvaluator4 } from "../conductor/PyPvmlEvaluator";

/** Minimal IRunnerPlugin mock, mirroring PyPvmlEvaluator.test.ts's, plus a
 * registerPlugin that hands loadImports a fake module loader bound to the
 * registering evaluator (the real ModuleLoaderRunnerPlugin likewise captures
 * the evaluator it's constructed with — that binding is exactly what the
 * evaluator's per-instance `moduleLoader` field exists to keep fresh).
 * `withModuleLoader: false` omits registerPlugin entirely, for asserting
 * that import-free chunks never touch the plugin pathway. */
function makeMockConductor(withModuleLoader: boolean = true) {
  const results: unknown[] = [];
  const errors: unknown[] = [];
  const outputs: string[] = [];
  const conductor = {
    sendResult: (r: unknown) => results.push(r),
    sendError: (e: unknown) => errors.push(e),
    sendOutput: (m: string) => outputs.push(m),
    ...(withModuleLoader && {
      registerPlugin: (_cls: unknown, _conductor: unknown, evaluator: IDataHandler) =>
        makeFakeLoader(evaluator),
    }),
  } as unknown as IRunnerPlugin;
  return { conductor, results, errors, outputs };
}

/** Builds a fake conductor module ("testmod") exercising every export shape
 * the converter handles: a constant, plain functions, a higher-order
 * function (module -> Python callback), and an opaque handle round-trip.
 * `dh` is the evaluator under test itself — exactly as in production, where
 * a module's closures/opaques live in the running evaluator's own
 * IDataHandler stores. */
async function makeTestModule(dh: IDataHandler): Promise<IModulePlugin> {
  const num = (value: number): TypedValue<DataType.NUMBER> => ({ type: DataType.NUMBER, value });

  const double = await dh.closure_make(
    { returnType: DataType.NUMBER, args: [DataType.NUMBER] },
    // eslint-disable-next-line @typescript-eslint/require-await
    async function* (x: TypedValue<DataType.NUMBER>) {
      return num(x.value * 2);
    },
  );

  const applyTwice = await dh.closure_make(
    { returnType: DataType.NUMBER, args: [DataType.CLOSURE, DataType.NUMBER] },
    async function* (f: TypedValue<DataType.CLOSURE>, x: TypedValue<DataType>) {
      const once = yield* dh.closure_call_unchecked(f, [x]);
      const twice = yield* dh.closure_call_unchecked(f, [once]);
      return twice;
    },
  );

  const makeThing = await dh.closure_make(
    { returnType: DataType.OPAQUE, args: [] },
    async function* () {
      const thing = await dh.opaque_make({ secret: 7 });
      return thing;
    },
  );

  const readThing = await dh.closure_make(
    { returnType: DataType.NUMBER, args: [DataType.OPAQUE] },
    async function* (o: TypedValue<DataType.OPAQUE>) {
      return num(((await dh.opaque_get(o)) as { secret: number }).secret);
    },
  );

  const makePair = await dh.closure_make(
    { returnType: DataType.PAIR, args: [] },
    async function* () {
      const pair = await dh.pair_make(num(1), num(2));
      return pair;
    },
  );

  return {
    exports: [
      { symbol: "answer", value: num(42) },
      { symbol: "double", value: double },
      { symbol: "apply_twice", value: applyTwice },
      { symbol: "make_thing", value: makeThing },
      { symbol: "read_thing", value: readThing },
      { symbol: "make_pair", value: makePair },
    ],
  } as unknown as IModulePlugin;
}

/** A fake module loader that serves "testmod" (built against `dh`) and
 * rejects everything else — what the mock conductor's registerPlugin hands
 * back to loadImports. */
function makeFakeLoader(dh: IDataHandler) {
  return {
    requestModule: async (moduleName: string) => {
      if (moduleName !== "testmod") {
        throw new Error(`no such module: ${moduleName}`);
      }
      return makeTestModule(dh);
    },
  };
}

describe("PyPvmlEvaluator module imports", () => {
  test("imports a constant", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator4(conductor);

    await evaluator.evaluateChunk("from testmod import answer\nprint(answer)\n");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["42.0"]);
  });

  test("imports under an alias", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator4(conductor);

    await evaluator.evaluateChunk("from testmod import answer as a\nprint(a)\n");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["42.0"]);
  });

  test("calls an imported module function", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator4(conductor);

    await evaluator.evaluateChunk("from testmod import double\nprint(double(21))\n");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["42.0"]);
  });

  test("a module function can call a Python closure back (higher-order)", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator4(conductor);

    await evaluator.evaluateChunk(
      "from testmod import apply_twice\ndef inc(n):\n    return n + 1\nprint(apply_twice(inc, 1))\n",
    );

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["3.0"]);
  });

  test("opaque module handles round-trip and str() as <opaque object>", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator4(conductor);

    await evaluator.evaluateChunk(
      "from testmod import make_thing, read_thing\nt = make_thing()\nprint(t)\nprint(read_thing(t))\n",
    );

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["<opaque object>", "7.0"]);
  });

  test("a module PAIR converts to a PVML pair (head/tail work)", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator4(conductor);

    await evaluator.evaluateChunk(
      "from testmod import make_pair\np = make_pair()\nprint(head(p))\nprint(tail(p))\n",
    );

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["1.0", "2.0"]);
  });

  test("imported bindings persist into later chunks (REPL model)", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator4(conductor);

    await evaluator.evaluateChunk("from testmod import double\n");
    await evaluator.evaluateChunk("print(double(5))\n");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["10.0"]);
  });

  test("imports work at chapter 1 too", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator1(conductor);

    await evaluator.evaluateChunk("from testmod import double\nprint(double(21))\n");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["42.0"]);
  });

  test("an unknown module reports an error via sendError", async () => {
    const { conductor, errors } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator4(conductor);

    await evaluator.evaluateChunk("from nosuchmod import whatever\n");

    expect(errors).toHaveLength(1);
  });

  test("a missing export reports an error via sendError", async () => {
    const { conductor, errors } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator4(conductor);

    await evaluator.evaluateChunk("from testmod import nonexistent\n");

    expect(errors).toHaveLength(1);
  });

  test("chunks without imports never touch the module loader", async () => {
    // The mock conductor has no registerPlugin at all — an import-free chunk
    // completing without error proves the plugin pathway was never touched.
    const { conductor, errors, outputs } = makeMockConductor(false);
    const evaluator = new PyPvmlEvaluator4(conductor);

    await evaluator.evaluateChunk("print(1 + 1)\n");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["2"]);
  });

  test("each evaluator gets its own module-loader binding (no stale singleton)", async () => {
    // Two evaluators on separate conductors, sharing one JS realm — the
    // regression Gemini's review flagged: with a static-singleton guard, the
    // second evaluator would reuse the first's loader, whose modules would
    // build values in the *first* evaluator's IDataHandler stores, making
    // them unresolvable ("Invalid pair identifier") for the second.
    const first = makeMockConductor();
    const evaluator1 = new PyPvmlEvaluator4(first.conductor);
    await evaluator1.evaluateChunk("from testmod import make_pair\nprint(head(make_pair()))\n");

    const second = makeMockConductor();
    const evaluator2 = new PyPvmlEvaluator4(second.conductor);
    await evaluator2.evaluateChunk("from testmod import make_pair\nprint(head(make_pair()))\n");

    expect(first.errors).toEqual([]);
    expect(second.errors).toEqual([]);
    expect(first.outputs).toEqual(["1.0"]);
    expect(second.outputs).toEqual(["1.0"]);
  });
});
