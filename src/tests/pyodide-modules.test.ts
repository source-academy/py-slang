/**
 * Conductor-module-import tests for the pyodide engine — mirrors
 * wasm-modules.test.ts/pvml-modules.test.ts's structure, adapted for a real
 * pyodide runtime (see PyodideEvaluator.test.ts for why these are slow on a
 * cold cache).
 *
 * The `run_sync`/JSPI bridge (see src/engines/pyodide/moduleInterop.ts) is
 * only available under `node --experimental-wasm-jspi` (or a JSPI-capable
 * browser) — not the default `npm test` environment.
 *
 * The one test that exercises a module function with no `.sync` twin (no
 * fast path to fall back on) checks `isJspiAvailable` itself and asserts the
 * behaviour that's actually correct for whichever environment is running it:
 * a real result when JSPI is there, the same clean "stack switching not
 * supported" error `run_sync` itself raises when it isn't. Both branches are
 * meaningful there — that one is not a skip.
 *
 * The other JSPI-dependent tests below (`jspiTest`) have no such fallback
 * assertion to make when JSPI is unavailable, so they're registered as an
 * actual Jest skip in that case instead of `return`ing before any `expect` —
 * a bare early return would report as a false "passed" with zero assertions,
 * which would hide a real regression in the `run_sync` path on a CI run that
 * (as of writing) has no JSPI flag at all.
 */
import type { IModulePlugin } from "@sourceacademy/conductor/module";
import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { DataType, IDataHandler, TypedValue } from "@sourceacademy/conductor/types";
import { PyodideEvaluator3, PyodideEvaluatorFull } from "../conductor/PyodideEvaluator";
import { isJspiAvailable } from "../engines/pyodide/moduleInterop";
import { loadPyodideGeneric } from "../engines/pyodide/loadPyodide";

const PYODIDE_TIMEOUT = 60_000;

/** Computed once at module scope (real ESM here — see jest.config.js's
 * testPathIgnorePatterns comment — so top-level await works) rather than
 * per-test: JSPI support can't change mid-session, and every affected test
 * below needs the same answer either to pick its assertion branch or to
 * decide whether to run at all. */
const jspiAvailable = await isJspiAvailable(await loadPyodideGeneric());
const jspiTest = jspiAvailable ? test : test.skip;

/** Minimal IRunnerPlugin mock, mirroring wasm-modules.test.ts's: a
 * registerPlugin that hands PyodideEvaluatorBase a fake module loader bound
 * to the registering evaluator's own dataHandler. The no-module-loader case
 * (tryRegisterConductorModule's `requestModule` throwing, every import
 * falling back to micropip) is already covered by PyodideEvaluator.test.ts's
 * "never eagerly installed" test, not duplicated here. */
function makeMockConductor() {
  const results: unknown[] = [];
  const errors: { name: string; message: string }[] = [];
  const outputs: string[] = [];
  const conductor = {
    sendResult: (r: unknown) => results.push(r),
    sendError: (e: unknown) => errors.push(e as { name: string; message: string }),
    sendOutput: (m: string) => outputs.push(m),
    hostLoadPlugin: () => Promise.resolve(),
    registerPlugin: (_cls: unknown, _conductor: unknown, evaluator: IDataHandler) =>
      makeFakeLoader(evaluator),
  } as unknown as IRunnerPlugin;
  return { conductor, results, errors, outputs };
}

/** Builds a fake conductor module ("testmod") exercising every DataType
 * shape moduleInterop.ts handles: a constant, a plain function (no `.sync`
 * twin - exercises run_sync), a function WITH a `.sync` twin (exercises the
 * synchronous fast path instead), a higher-order function that calls back
 * into a Python closure via the CHECKED dh.closure_call (this specific shape
 * is what caught the InvalidArityError bug during development - a module
 * calling a Python callback through the unchecked variant alone would never
 * have caught it), and an opaque handle round-trip. */
async function makeTestModule(dh: IDataHandler): Promise<IModulePlugin> {
  const num = (value: number): TypedValue<DataType.NUMBER> => ({ type: DataType.NUMBER, value });

  const double = await dh.closure_make(
    { returnType: DataType.NUMBER, args: [DataType.NUMBER] },
    // eslint-disable-next-line @typescript-eslint/require-await
    async function* (x: TypedValue<DataType.NUMBER>) {
      return num(x.value * 2);
    },
  );

  // closure_make stores exactly the function reference passed to it (see
  // GenericDataHandler.closure_call_sync, which reads `.sync` off that same
  // stored `func`) - a fresh, distinct `{type, value}` object comes back out
  // as the awaited result, so `.sync` has to be attached to this named
  // reference BEFORE it's passed in, not to closure_make's return value
  // (confirmed the hard way: attaching it to the return value compiles and
  // type-checks fine, but closure_call_sync then never finds it, silently
  // falling through to run_sync every time - invisible whenever JSPI happens
  // to be available, since the async fallback still produces the same
  // answer, just not through the fast path this test means to exercise).
  // eslint-disable-next-line @typescript-eslint/require-await
  const incrementSyncFn = async function* (x: TypedValue<DataType.NUMBER>) {
    return num(x.value + 1);
  };
  (
    incrementSyncFn as unknown as {
      sync?: (...a: TypedValue<DataType>[]) => TypedValue<DataType> | undefined;
    }
  ).sync = (...args: TypedValue<DataType>[]) => {
    const a = args[0];
    return a?.type === DataType.NUMBER ? num(a.value + 1) : undefined;
  };
  const incrementSync = await dh.closure_make(
    { returnType: DataType.NUMBER, args: [DataType.NUMBER] },
    incrementSyncFn,
  );

  const applyTwice = await dh.closure_make(
    { returnType: DataType.NUMBER, args: [DataType.CLOSURE, DataType.NUMBER] },
    async function* (f: TypedValue<DataType.CLOSURE>, x: TypedValue<DataType>) {
      const once = yield* dh.closure_call(f, [x], DataType.NUMBER);
      const twice = yield* dh.closure_call(f, [once], DataType.NUMBER);
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

  const headOf = await dh.closure_make(
    { returnType: DataType.NUMBER, args: [DataType.PAIR] },
    async function* (p: TypedValue<DataType.PAIR>) {
      return dh.pair_head(p);
    },
  );

  return {
    exports: [
      { symbol: "answer", value: num(42) },
      { symbol: "double", value: double },
      { symbol: "increment_sync", value: incrementSync },
      { symbol: "apply_twice", value: applyTwice },
      { symbol: "make_thing", value: makeThing },
      { symbol: "read_thing", value: readThing },
      { symbol: "head_of", value: headOf },
    ],
  } as unknown as IModulePlugin;
}

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

describe("PyodideEvaluator module imports", () => {
  test(
    "imports a numeric constant",
    async () => {
      const { conductor, errors, outputs } = makeMockConductor();
      const evaluator = new PyodideEvaluator3(conductor);

      await evaluator.evaluateChunk("from testmod import answer\nprint(answer)\n");

      expect(errors).toEqual([]);
      expect(outputs).toEqual(["42"]);
    },
    PYODIDE_TIMEOUT,
  );

  test(
    "calls a module function with no .sync twin, correctly for this environment's JSPI support",
    async () => {
      const { conductor, errors, outputs } = makeMockConductor();
      const evaluator = new PyodideEvaluator3(conductor);

      await evaluator.evaluateChunk("from testmod import double\nprint(double(5))\n");

      if (jspiAvailable) {
        expect(errors).toEqual([]);
        expect(outputs).toEqual(["10"]);
      } else {
        expect(outputs).toEqual([]);
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toContain("stack switching not supported");
      }
    },
    PYODIDE_TIMEOUT,
  );

  test(
    "calls a module function through its .sync fast path — works regardless of JSPI",
    async () => {
      const { conductor, errors, outputs } = makeMockConductor();
      const evaluator = new PyodideEvaluator3(conductor);

      await evaluator.evaluateChunk(
        "from testmod import increment_sync\nprint(increment_sync(10))\n",
      );

      expect(errors).toEqual([]);
      expect(outputs).toEqual(["11"]);
    },
    PYODIDE_TIMEOUT,
  );

  jspiTest(
    "a module calling back into a Python closure through the CHECKED dh.closure_call",
    async () => {
      // needs run_sync (no .sync twin on apply_twice) - see file doc.
      const { conductor, errors, outputs } = makeMockConductor();
      const evaluator = new PyodideEvaluator3(conductor);

      await evaluator.evaluateChunk(
        "from testmod import apply_twice\ndef add_one(x):\n    return x + 1\nprint(apply_twice(add_one, 3))\n",
      );

      expect(errors).toEqual([]);
      expect(outputs).toEqual(["5"]);
    },
    PYODIDE_TIMEOUT,
  );

  jspiTest(
    "an opaque value round-trips through two module calls",
    async () => {
      const { conductor, errors, outputs } = makeMockConductor();
      const evaluator = new PyodideEvaluator3(conductor);

      await evaluator.evaluateChunk(
        "from testmod import make_thing, read_thing\nt = make_thing()\nprint(read_thing(t))\n",
      );

      expect(errors).toEqual([]);
      expect(outputs).toEqual(["7"]);
    },
    PYODIDE_TIMEOUT,
  );

  jspiTest(
    "a real Python pair, built with the bridged sicp pair(), round-trips through a module call",
    async () => {
      const { conductor, errors, outputs } = makeMockConductor();
      const evaluator = new PyodideEvaluator3(conductor);

      await evaluator.evaluateChunk("from testmod import head_of\nprint(head_of(pair(1, 2)))\n");

      expect(errors).toEqual([]);
      expect(outputs).toEqual(["1"]);
    },
    PYODIDE_TIMEOUT,
  );

  test(
    "a later chunk, with no import of its own, still calls a function an earlier chunk imported",
    async () => {
      const { conductor, errors, outputs } = makeMockConductor();
      const evaluator = new PyodideEvaluator3(conductor);

      // REPL persistence: `double` is bound in the student's global namespace
      // from chunk 1 onward. This also exercises hasImportedAnyModule's
      // stickiness (PyodideEvaluator.ts) - chunk 2 has no FromImport at all,
      // so only the sticky flag (not a per-chunk import scan) makes it route
      // through the callPromising path when this needs run_sync.
      await evaluator.evaluateChunk("from testmod import increment_sync\n");
      await evaluator.evaluateChunk("print(increment_sync(1))\n");

      expect(errors).toEqual([]);
      expect(outputs).toEqual(["2"]);
    },
    PYODIDE_TIMEOUT,
  );

  test(
    "importing an unknown conductor module reports a clear error",
    async () => {
      const { conductor, errors, outputs } = makeMockConductor();
      const evaluator = new PyodideEvaluator3(conductor);

      await evaluator.evaluateChunk("from no_such_module import whatever\n");

      expect(outputs).toEqual([]);
      expect(errors).toHaveLength(1);
    },
    PYODIDE_TIMEOUT,
  );

  test(
    "PyodideEvaluatorFull can import a conductor module too, alongside unrestricted Python",
    async () => {
      const { conductor, errors, outputs } = makeMockConductor();
      const evaluator = new PyodideEvaluatorFull(conductor);

      await evaluator.evaluateChunk(
        "from testmod import increment_sync\nprint([increment_sync(x) for x in range(3)])\n",
      );

      expect(errors).toEqual([]);
      expect(outputs).toEqual(["[1, 2, 3]"]);
    },
    PYODIDE_TIMEOUT,
  );
});
