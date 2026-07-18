import type { IModulePlugin } from "@sourceacademy/conductor/module";
import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { DataType, IDataHandler, TypedValue } from "@sourceacademy/conductor/types";
import { ModuleLoaderRunnerPlugin } from "@sourceacademy/runner-module-loader";
import { PyPvmlEvaluator1, PyPvmlEvaluator4 } from "../conductor/PyPvmlEvaluator";

/** Minimal IRunnerPlugin mock, mirroring PyPvmlEvaluator.test.ts's. The
 * module pathway never needs registerPlugin here because every test presets
 * ModuleLoaderRunnerPlugin.instance (see makeFakeLoader) — loadImports only
 * registers the plugin when no instance exists yet. */
function makeMockConductor() {
  const results: unknown[] = [];
  const errors: unknown[] = [];
  const outputs: string[] = [];
  const conductor = {
    sendResult: (r: unknown) => results.push(r),
    sendError: (e: unknown) => errors.push(e),
    sendOutput: (m: string) => outputs.push(m),
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

/** Presets ModuleLoaderRunnerPlugin.instance with a fake that serves
 * "testmod" (built against `dh`) and rejects everything else. */
function makeFakeLoader(dh: IDataHandler): void {
  ModuleLoaderRunnerPlugin.instance = {
    requestModule: async (moduleName: string) => {
      if (moduleName !== "testmod") {
        throw new Error(`no such module: ${moduleName}`);
      }
      return makeTestModule(dh);
    },
  } as unknown as ModuleLoaderRunnerPlugin;
}

afterEach(() => {
  ModuleLoaderRunnerPlugin.instance = null;
});

describe("PyPvmlEvaluator module imports", () => {
  test("imports a constant", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator4(conductor);
    makeFakeLoader(evaluator);

    await evaluator.evaluateChunk("from testmod import answer\nprint(answer)\n");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["42.0"]);
  });

  test("imports under an alias", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator4(conductor);
    makeFakeLoader(evaluator);

    await evaluator.evaluateChunk("from testmod import answer as a\nprint(a)\n");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["42.0"]);
  });

  test("calls an imported module function", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator4(conductor);
    makeFakeLoader(evaluator);

    await evaluator.evaluateChunk("from testmod import double\nprint(double(21))\n");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["42.0"]);
  });

  test("a module function can call a Python closure back (higher-order)", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator4(conductor);
    makeFakeLoader(evaluator);

    await evaluator.evaluateChunk(
      "from testmod import apply_twice\ndef inc(n):\n    return n + 1\nprint(apply_twice(inc, 1))\n",
    );

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["3.0"]);
  });

  test("opaque module handles round-trip and str() as <opaque object>", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator4(conductor);
    makeFakeLoader(evaluator);

    await evaluator.evaluateChunk(
      "from testmod import make_thing, read_thing\nt = make_thing()\nprint(t)\nprint(read_thing(t))\n",
    );

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["<opaque object>", "7.0"]);
  });

  test("a module PAIR converts to a PVML pair (head/tail work)", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator4(conductor);
    makeFakeLoader(evaluator);

    await evaluator.evaluateChunk(
      "from testmod import make_pair\np = make_pair()\nprint(head(p))\nprint(tail(p))\n",
    );

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["1.0", "2.0"]);
  });

  test("imported bindings persist into later chunks (REPL model)", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator4(conductor);
    makeFakeLoader(evaluator);

    await evaluator.evaluateChunk("from testmod import double\n");
    await evaluator.evaluateChunk("print(double(5))\n");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["10.0"]);
  });

  test("imports work at chapter 1 too", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator1(conductor);
    makeFakeLoader(evaluator);

    await evaluator.evaluateChunk("from testmod import double\nprint(double(21))\n");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["42.0"]);
  });

  test("an unknown module reports an error via sendError", async () => {
    const { conductor, errors } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator4(conductor);
    makeFakeLoader(evaluator);

    await evaluator.evaluateChunk("from nosuchmod import whatever\n");

    expect(errors).toHaveLength(1);
  });

  test("a missing export reports an error via sendError", async () => {
    const { conductor, errors } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator4(conductor);
    makeFakeLoader(evaluator);

    await evaluator.evaluateChunk("from testmod import nonexistent\n");

    expect(errors).toHaveLength(1);
  });

  test("chunks without imports never touch the module loader", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator4(conductor);
    // Deliberately no fake loader, and the mock conductor has no
    // registerPlugin — proving import-free chunks skip the pathway entirely.

    await evaluator.evaluateChunk("print(1 + 1)\n");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["2"]);
  });
});
