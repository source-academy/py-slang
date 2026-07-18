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

  // Mirrors sound's actual sine_sound -> play shape precisely: sine_sound's own body wraps a
  // plain JS wave as a *new* closure (waveToConductorClosure -> closure_make), and play's own
  // body later calls that closure many times via closure_call_unchecked (sampleWave's loop) -
  // not just one call each, an extern creating a closure that a *different* extern then
  // repeatedly invokes.
  const makeWave = await dh.closure_make(
    { returnType: DataType.CLOSURE, args: [DataType.NUMBER] },
    async function* (freq: TypedValue<DataType.NUMBER>) {
      return dh.closure_make(
        { returnType: DataType.NUMBER, args: [DataType.NUMBER] },
        // eslint-disable-next-line @typescript-eslint/require-await
        async function* (t: TypedValue<DataType.NUMBER>) {
          return num(Math.sin(freq.value * t.value));
        },
      );
    },
  );

  const sampleWave = await dh.closure_make(
    { returnType: DataType.NUMBER, args: [DataType.CLOSURE] },
    async function* (wave: TypedValue<DataType.CLOSURE>) {
      let sum = num(0);
      for (let i = 0; i < 5; i += 1) {
        sum = yield* dh.closure_call_unchecked(
          wave as TypedValue<DataType.CLOSURE, DataType.NUMBER>,
          [num(i)],
        );
      }
      return sum;
    },
  );

  // Mirrors sound's simultaneously(list(sine_sound(...), sine_sound(...))): a *third* extern
  // (combineWaves) creates its own brand-new closure whose own body, when later sampled, calls
  // back into two other module-crossing closures - a genuinely deeper chain than makeWave's
  // (module creates closure -> different module samples it once). Here: module A creates two
  // closures, module B combines them into a new closure of its own, module C samples *that* -
  // which in turn re-invokes the original two, each independently re-entering the interpreter.
  const combineWaves = await dh.closure_make(
    { returnType: DataType.CLOSURE, args: [DataType.CLOSURE, DataType.CLOSURE] },
    async function* (
      waveA: TypedValue<DataType.CLOSURE>,
      waveB: TypedValue<DataType.CLOSURE>,
    ) {
      return dh.closure_make(
        { returnType: DataType.NUMBER, args: [DataType.NUMBER] },
        async function* (t: TypedValue<DataType.NUMBER>) {
          const a = yield* dh.closure_call_unchecked(
            waveA as TypedValue<DataType.CLOSURE, DataType.NUMBER>,
            [t],
          );
          const b = yield* dh.closure_call_unchecked(
            waveB as TypedValue<DataType.CLOSURE, DataType.NUMBER>,
            [t],
          );
          return num(a.value + b.value);
        },
      );
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
      { symbol: "make_wave", value: makeWave },
      { symbol: "sample_wave", value: sampleWave },
      { symbol: "combine_waves", value: combineWaves },
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

  test("a closure created by one module call can be invoked by another, repeatedly", async () => {
    // Mirrors sound's actual sine_sound -> play shape: sine_sound's own body wraps a plain wave
    // as a *new* closure (waveToConductorClosure -> closure_make), and play's own body later
    // calls that closure many times (sampleWave's loop). Any closure that crosses the module
    // boundary is represented in PVML as an "extern" value - invoking it later re-enters via
    // invokeValueAsync with func itself being an extern, awaiting dispatchCall's parked
    // pendingExtern instead of rejecting it (see invokeValueAsync's doc comment). Previously this
    // threw "Stack underflow" (a missing guard), then a correctly-surfaced but unhelpful
    // "cannot call imported module function" RuntimeError (the guard doing its documented job,
    // just not what real modules like sound actually need) - now it genuinely completes.
    // print(...), not a bare statement - capturing a bare top-level extern call's value as the
    // chunk's own result is a separate, pre-existing bug (also reproducible with no closures
    // involved at all, e.g. a bare `double(double(21))`), independent of this one.
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator4(conductor);

    await evaluator.evaluateChunk(
      "from testmod import sample_wave, make_wave\nprint(sample_wave(make_wave(440)))\n",
    );

    expect(errors).toEqual([]);
    expect(outputs).toEqual([String(Math.sin(440 * 4))]);
  });

  test("nesting goes deeper than one level: a combined closure invoking two other module-crossing closures", async () => {
    // Mirrors sound's play(simultaneously(list(sine_sound(...), sine_sound(...)))): module A
    // (make_wave) creates two closures crossing into student code, module B (combine_waves)
    // creates a brand-new closure of its own whose body calls back into *both* of those, and
    // module C (sample_wave) samples that combined closure - so invokeValueAsync's own await of
    // one pending extern (combine_waves's combined closure) must itself, from within that same
    // await, correctly handle two further nested pending externs (waveA, waveB).
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new PyPvmlEvaluator4(conductor);

    await evaluator.evaluateChunk(
      "from testmod import sample_wave, make_wave, combine_waves\n" +
        "combined = combine_waves(make_wave(440), make_wave(220))\n" +
        "print(sample_wave(combined))\n",
    );

    expect(errors).toEqual([]);
    const expected = Math.sin(440 * 4) + Math.sin(220 * 4);
    expect(outputs).toEqual([String(expected)]);
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
