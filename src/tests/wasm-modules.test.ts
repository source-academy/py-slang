import type { IModulePlugin } from "@sourceacademy/conductor/module";
import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { DataType, IDataHandler, TypedValue } from "@sourceacademy/conductor/types";
import { PyWasmEvaluator3 } from "../conductor/PyWasmEvaluator";
import { getJspi } from "../engines/wasm/moduleInterop";

/** Minimal IRunnerPlugin mock, mirroring pvml-modules.test.ts's: a
 * registerPlugin that hands loadImports a fake module loader bound to the
 * registering evaluator (the real ModuleLoaderRunnerPlugin likewise
 * captures the evaluator it's constructed with). `withModuleLoader: false`
 * omits registerPlugin entirely, for asserting that import-free chunks
 * never touch the plugin pathway. */
function makeMockConductor(withModuleLoader: boolean = true) {
  const results: unknown[] = [];
  const errors: unknown[] = [];
  const outputs: string[] = [];
  let dataHandler: IDataHandler | undefined;
  const conductor = {
    sendResult: (r: unknown) => results.push(r),
    sendError: (e: unknown) => errors.push(e),
    sendOutput: (m: string) => outputs.push(m),
    ...(withModuleLoader && {
      registerPlugin: (_cls: unknown, _conductor: unknown, evaluator: IDataHandler) => {
        dataHandler = evaluator;
        return makeFakeLoader(evaluator);
      },
    }),
  } as unknown as IRunnerPlugin;
  return { conductor, results, errors, outputs, getDataHandler: () => dataHandler! };
}

/** Builds a fake conductor module ("testmod") exercising the DataType
 * shapes the WASM converter (moduleInterop.ts) actually handles: a
 * constant, a plain function, a higher-order function (module -> Python
 * callback), and an opaque handle round-trip. ARRAY isn't included —
 * moduleInterop.ts's typedToHostValue doesn't support it yet. */
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
      return dh.opaque_make({ secret: 7 });
    },
  );

  const readThing = await dh.closure_make(
    { returnType: DataType.NUMBER, args: [DataType.OPAQUE] },
    async function* (o: TypedValue<DataType.OPAQUE>) {
      return num(((await dh.opaque_get(o)) as { secret: number }).secret);
    },
  );

  return {
    exports: [
      { symbol: "answer", value: num(42) },
      { symbol: "flag", value: { type: DataType.BOOLEAN, value: true } },
      { symbol: "greeting", value: { type: DataType.CONST_STRING, value: "hello" } },
      { symbol: "double", value: double },
      { symbol: "apply_twice", value: applyTwice },
      { symbol: "make_thing", value: makeThing },
      { symbol: "read_thing", value: readThing },
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

describe("PyWasmEvaluator module imports", () => {
  test("imports a numeric constant", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyWasmEvaluator3(conductor);

    await evaluator.evaluateChunk("from testmod import answer\nprint(answer)\n");

    expect(errors).toEqual([]);
    // evaluateChunk runs in interactive mode, so the chunk's own final
    // expression value (print()'s own None return) is rendered too, after
    // whatever print() itself already sent to output.
    expect(outputs).toEqual(["42", "None"]);
  });

  test("imports a bool and a string constant", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyWasmEvaluator3(conductor);

    await evaluator.evaluateChunk(
      "from testmod import flag, greeting\nprint(flag)\nprint(greeting)\n",
    );

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["True", "hello", "None"]);
  });

  test("imports under an alias", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyWasmEvaluator3(conductor);

    await evaluator.evaluateChunk("from testmod import answer as a\nprint(a)\n");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["42", "None"]);
  });

  test("a chunk with no imports never touches the module loader", async () => {
    const { conductor, errors, outputs } = makeMockConductor(false);
    const evaluator = new PyWasmEvaluator3(conductor);

    await evaluator.evaluateChunk("print(1 + 1)\n");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["2", "None"]);
  });

  test("an unknown module reports an error", async () => {
    const { conductor, errors } = makeMockConductor();
    const evaluator = new PyWasmEvaluator3(conductor);

    await evaluator.evaluateChunk("from nope import x\nprint(x)\n");

    expect(errors.length).toBeGreaterThan(0);
  });

  test("an unknown export name reports an error", async () => {
    const { conductor, errors } = makeMockConductor();
    const evaluator = new PyWasmEvaluator3(conductor);

    await evaluator.evaluateChunk("from testmod import nonexistent\nprint(nonexistent)\n");

    expect(errors.length).toBeGreaterThan(0);
  });

  // Calling an imported module *function* requires JSPI (WebAssembly.Suspending/
  // promising) — absent on this runtime, it's supposed to fail loudly (see
  // index.ts) rather than hang or silently misbehave; present, the call must
  // actually go through, JSPI suspend-and-resume included.
  if (getJspi()) {
    test("calls an imported module function (JSPI available)", async () => {
      const { conductor, errors, outputs } = makeMockConductor();
      const evaluator = new PyWasmEvaluator3(conductor);

      await evaluator.evaluateChunk("from testmod import double\nprint(double(21))\n");

      expect(errors).toEqual([]);
      expect(outputs).toEqual(["42", "None"]);
    });

    test("a higher-order module function calls back into a Python closure", async () => {
      const { conductor, errors, outputs } = makeMockConductor();
      const evaluator = new PyWasmEvaluator3(conductor);

      await evaluator.evaluateChunk(
        "from testmod import apply_twice\n" +
          "def add_one(x):\n    return x + 1\n" +
          "print(apply_twice(add_one, 5))\n",
      );

      expect(errors).toEqual([]);
      expect(outputs).toEqual(["7", "None"]);
    });

    test("an opaque handle round-trips through two module functions", async () => {
      const { conductor, errors, outputs } = makeMockConductor();
      const evaluator = new PyWasmEvaluator3(conductor);

      await evaluator.evaluateChunk(
        "from testmod import make_thing, read_thing\nprint(read_thing(make_thing()))\n",
      );

      expect(errors).toEqual([]);
      expect(outputs).toEqual(["7", "None"]);
    });
  } else {
    test("calling an imported module function without JSPI fails loudly", async () => {
      const { conductor, errors } = makeMockConductor();
      const evaluator = new PyWasmEvaluator3(conductor);

      await evaluator.evaluateChunk("from testmod import double\nprint(double(21))\n");

      expect(errors.length).toBeGreaterThan(0);
    });
  }
});
