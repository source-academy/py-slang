/**
 * End-to-end `from X import y` tests through Py2JsSession — the module
 * loader (moduleInterop.ts's loadChunkImports), FromImport codegen
 * (compiler.ts), and dual compile mode all wired together, against a fake
 * conductor module (ModuleLoaderRunnerPlugin.instance mocked, matching how
 * the real plugin resolves `requestModule`).
 *
 * The flagship scenario ("module calls a Python function it was handed") is
 * exactly the sound-module case that motivated py2js's dual-compilation
 * design (see experiments/py2js/README.md): a fake `play(wave, n)` module
 * function samples a Python-defined `wave` function n times, calling back
 * through conductor's own generic closure protocol (closure_call_unchecked)
 * — never touching rt.callSync directly, since real module code is
 * engine-agnostic; the fast synchronous path lives entirely inside
 * moduleInterop.ts's own closure_make wrapper, invisible to the module.
 */
import { DataType, TypedValue } from "@sourceacademy/conductor/types";
import { ModuleLoaderRunnerPlugin } from "@sourceacademy/runner-module-loader";
import { GenericDataHandler } from "../conductor/GenericDataHandler";
import { Py2JsSession } from "../engines/py2js";

type FakeExport = { symbol: string; value: TypedValue<DataType> };

/** A fake IModulePlugin exposing the given exports, installed as
 * ModuleLoaderRunnerPlugin.instance so loadChunkImports's requestModule call
 * resolves without a real conduit/plugin registration. */
function installFakeModule(exportsByModule: Record<string, FakeExport[]>) {
  ModuleLoaderRunnerPlugin.instance = {
    requestModule: (name: string) => {
      const exports = exportsByModule[name];
      if (!exports) return Promise.reject(new Error(`no such module: ${name}`));
      return Promise.resolve({ exports });
    },
  } as unknown as ModuleLoaderRunnerPlugin;
}

afterEach(() => {
  ModuleLoaderRunnerPlugin.instance = null;
});

function makeSession(dh: GenericDataHandler) {
  const outputs: string[] = [];
  const session = new Py2JsSession(1, { onOutput: line => outputs.push(line), dataHandler: dh });
  return { session, outputs };
}

test("imports a scalar constant and a simple function", async () => {
  const dh = new GenericDataHandler();
  async function* addFunc(
    a: TypedValue<DataType>,
    b: TypedValue<DataType>,
  ): AsyncGenerator<void, TypedValue<DataType>, undefined> {
    await Promise.resolve(); // conductor's ExternCallable contract requires an async generator
    return {
      type: DataType.NUMBER,
      value: (a as TypedValue<DataType.NUMBER>).value + (b as TypedValue<DataType.NUMBER>).value,
    };
  }
  const add = await dh.closure_make(
    { returnType: DataType.NUMBER, args: [DataType.NUMBER, DataType.NUMBER] },
    addFunc,
  );
  installFakeModule({
    physics: [
      { symbol: "gravity", value: { type: DataType.NUMBER, value: 9.8 } },
      { symbol: "add", value: add },
    ],
  });

  const { session, outputs } = makeSession(dh);
  await session.runChunk("from physics import gravity, add\nprint(gravity)\nprint(add(2, 3))\n");

  expect(outputs).toEqual(["9.8", "5.0"]);
});

test("two imports binding the same name resolve in source order, last one wins", async () => {
  // moduleToPython's CLOSURE branch awaits dh.closure_arity() before it can
  // build the bound function — one more microtask hop than the NUMBER branch
  // (a synchronous value, no internal await). That timing difference is real
  // (not an artificial delay), so under the old concurrent-Promise.all
  // binding this is a deterministic repro, not a flaky race: `slow`'s CLOSURE
  // binding always resolves after `fast`'s NUMBER binding regardless of which
  // import statement comes first in source, so the *first* import (being the
  // slower one) would always win — backwards from Python's last-assignment-
  // wins semantics. Binding sequentially in source order fixes that: `fast`
  // (the textually-last import) must win here.
  const dh = new GenericDataHandler();
  async function* neverCalled(): AsyncGenerator<void, TypedValue<DataType>, undefined> {
    await Promise.resolve();
    throw new Error("should never be invoked by this test");
  }
  const slowClosure = await dh.closure_make({ returnType: DataType.NUMBER, args: [] }, neverCalled);
  installFakeModule({
    slowmod: [{ symbol: "x", value: slowClosure }],
    fastmod: [{ symbol: "x", value: { type: DataType.NUMBER, value: 42 } }],
  });

  const { session, outputs } = makeSession(dh);
  await session.runChunk("from slowmod import x\nfrom fastmod import x\nprint(x)\n");

  expect(outputs).toEqual(["42.0"]);
});

test("import with an alias binds under the aliased name", async () => {
  const dh = new GenericDataHandler();
  installFakeModule({
    physics: [{ symbol: "gravity", value: { type: DataType.NUMBER, value: 9.8 } }],
  });

  const { session, outputs } = makeSession(dh);
  await session.runChunk("from physics import gravity as g\nprint(g)\n");

  expect(outputs).toEqual(["9.8"]);
});

test("a chunk with no imports still runs on the fast sync path", async () => {
  const dh = new GenericDataHandler();
  const { session, outputs } = makeSession(dh);
  await session.runChunk("print(1 + 1)\n");
  expect(outputs).toEqual(["2"]);
});

test("an imported binding persists to later chunks", async () => {
  const dh = new GenericDataHandler();
  installFakeModule({
    physics: [{ symbol: "gravity", value: { type: DataType.NUMBER, value: 9.8 } }],
  });

  const { session, outputs } = makeSession(dh);
  await session.runChunk("from physics import gravity\n");
  await session.runChunk("print(gravity * 2)\n");

  expect(outputs).toEqual(["19.6"]);
});

test("importing from an unknown module raises ModuleNotFoundError", async () => {
  const dh = new GenericDataHandler();
  installFakeModule({});
  const { session } = makeSession(dh);
  await expect(session.runChunk("from nonexistent import x\n")).rejects.toThrow(/not found/);
});

test("importing an unknown name raises with the CPython ImportError wording", async () => {
  const dh = new GenericDataHandler();
  installFakeModule({
    physics: [{ symbol: "gravity", value: { type: DataType.NUMBER, value: 9.8 } }],
  });
  const { session } = makeSession(dh);
  await expect(session.runChunk("from physics import nonexistent\n")).rejects.toThrow(
    /cannot import name 'nonexistent' from 'physics'/,
  );
});

test("calling an imported function needing a round-trip works on the async spine", async () => {
  const dh = new GenericDataHandler();
  async function* slowDouble(
    x: TypedValue<DataType>,
  ): AsyncGenerator<void, TypedValue<DataType>, undefined> {
    await new Promise(resolve => setTimeout(resolve, 0)); // simulates a real round-trip
    return { type: DataType.NUMBER, value: (x as TypedValue<DataType.NUMBER>).value * 2 };
  }
  const closure = await dh.closure_make(
    { returnType: DataType.NUMBER, args: [DataType.NUMBER] },
    slowDouble,
  );
  installFakeModule({ physics: [{ symbol: "slow_double", value: closure }] });

  const { session, outputs } = makeSession(dh);
  await session.runChunk("from physics import slow_double\nprint(slow_double(21))\n");

  expect(outputs).toEqual(["42.0"]);
});

test("the sound-module scenario: a module samples a Python-defined function via conductor's generic closure protocol", async () => {
  const dh = new GenericDataHandler();

  // The fake module's own implementation of play(wave, n): calls wave(i)
  // for i in 0..n through dh.closure_call_unchecked — the same generic,
  // engine-agnostic protocol any real module uses. It never touches
  // rt.callSync; that fast path lives entirely inside moduleInterop.ts's
  // own closure_make wrapper on the Python side.
  async function* playFunc(
    waveArg: TypedValue<DataType>,
    nArg: TypedValue<DataType>,
  ): AsyncGenerator<void, TypedValue<DataType>, undefined> {
    const wave = waveArg as TypedValue<DataType.CLOSURE>;
    const n = (nArg as TypedValue<DataType.NUMBER>).value;
    let total = 0;
    for (let i = 0; i < n; i++) {
      const gen = dh.closure_call_unchecked(wave, [{ type: DataType.NUMBER, value: i }]);
      let step = await gen.next();
      while (!step.done) step = await gen.next();
      total += (step.value as TypedValue<DataType.NUMBER>).value;
    }
    return { type: DataType.NUMBER, value: total };
  }
  const play = await dh.closure_make(
    { returnType: DataType.NUMBER, args: [DataType.CLOSURE, DataType.NUMBER] },
    playFunc,
  );
  installFakeModule({ audio: [{ symbol: "play", value: play }] });

  const { session, outputs } = makeSession(dh);
  // wave(t) = t * 2; play samples it at t = 0, 1, 2 -> 0 + 2 + 4 = 6
  await session.runChunk(
    "from audio import play\n" +
      "def wave(t):\n" +
      "    return t * 2.0\n" +
      "print(play(wave, 3))\n",
  );

  expect(outputs).toEqual(["6.0"]);
});

test("a synchronously-sampled Python callback cannot itself call an import needing a round-trip", async () => {
  const dh = new GenericDataHandler();

  async function* playFunc(
    waveArg: TypedValue<DataType>,
  ): AsyncGenerator<void, TypedValue<DataType>, undefined> {
    const wave = waveArg as TypedValue<DataType.CLOSURE>;
    const gen = dh.closure_call_unchecked(wave, [{ type: DataType.NUMBER, value: 0 }]);
    let step = await gen.next();
    while (!step.done) step = await gen.next();
    return step.value;
  }
  const play = await dh.closure_make(
    { returnType: DataType.NUMBER, args: [DataType.CLOSURE] },
    playFunc,
  );

  async function* slowHelper(
    x: TypedValue<DataType>,
  ): AsyncGenerator<void, TypedValue<DataType>, undefined> {
    await new Promise(resolve => setTimeout(resolve, 0));
    return x;
  }
  const helper = await dh.closure_make(
    { returnType: DataType.NUMBER, args: [DataType.NUMBER] },
    slowHelper,
  );

  installFakeModule({
    audio: [
      { symbol: "play", value: play },
      { symbol: "slow_helper", value: helper },
    ],
  });

  const { session } = makeSession(dh);
  await expect(
    session.runChunk(
      "from audio import play, slow_helper\n" +
        "def wave(t):\n" +
        "    return slow_helper(t)\n" +
        "print(play(wave))\n",
    ),
  ).rejects.toThrow(/needs a frontend round-trip/);
});

test("a module PAIR (a Sound-shaped value) round-trips through sine_sound/play", async () => {
  const dh = new GenericDataHandler();

  // sine_sound(freq, duration) returns a Sound: a dotted (frequency,
  // duration) pair - a real module value crossing the boundary as
  // DataType.PAIR, not a proper list. This is the exact shape that used to
  // hit the "module values of type PAIR are not supported" rejection: a
  // Python-side pair (a 2-element PyList) round-tripping back into a second
  // module call.
  async function* sineSoundFunc(
    freqArg: TypedValue<DataType>,
    durationArg: TypedValue<DataType>,
  ): AsyncGenerator<void, TypedValue<DataType>, undefined> {
    await Promise.resolve();
    return dh.pair_make(freqArg, durationArg);
  }
  const sineSound = await dh.closure_make(
    { returnType: DataType.PAIR, args: [DataType.NUMBER, DataType.NUMBER] },
    sineSoundFunc,
  );

  // play(sound) unpacks the (frequency, duration) pair it's handed and
  // returns frequency * duration, so the test can assert both halves of the
  // pair it received round-tripped correctly through Python and back.
  async function* playFunc(
    soundArg: TypedValue<DataType>,
  ): AsyncGenerator<void, TypedValue<DataType>, undefined> {
    await Promise.resolve();
    const sound = soundArg as TypedValue<DataType.PAIR>;
    const freq = (await dh.pair_head(sound)) as TypedValue<DataType.NUMBER>;
    const duration = (await dh.pair_tail(sound)) as TypedValue<DataType.NUMBER>;
    return { type: DataType.NUMBER, value: freq.value * duration.value };
  }
  const play = await dh.closure_make(
    { returnType: DataType.NUMBER, args: [DataType.PAIR] },
    playFunc,
  );

  installFakeModule({
    sound: [
      { symbol: "sine_sound", value: sineSound },
      { symbol: "play", value: play },
    ],
  });

  const { session, outputs } = makeSession(dh);
  await session.runChunk(
    "from sound import sine_sound, play\n" + "print(play(sine_sound(440, 2)))\n",
  );

  expect(outputs).toEqual(["880.0"]);
});

test("a module closure round-trips through a pair back into a second module call (the real sine_sound/play shape)", async () => {
  const dh = new GenericDataHandler();

  // sine_sound(freq, duration) returns a Sound: (wave closure, duration),
  // where wave is a closure *created by the module itself* (never a Python
  // function) - the real sound module's actual shape. This used to throw
  // "needs a frontend round-trip and cannot be called from a synchronous
  // module callback" the moment play() tried to sample it: moduleToPython
  // wrapped the incoming CLOSURE as an asyncOnly PyFunction with no memory
  // of its origin, so pythonToModule (handing it back to play()) assumed it
  // was a genuine Python function and wrapped it in a *new* closure whose
  // body did a synchronous rt.callSync - which throws for anything
  // asyncOnly. The fix: moduleToPython tags the PyFunction with the
  // original closure identifier (PyFunction.moduleClosure), and
  // pythonToModule returns that identifier unchanged instead of re-wrapping.
  async function* sineSoundFunc(
    freqArg: TypedValue<DataType>,
    durationArg: TypedValue<DataType>,
  ): AsyncGenerator<void, TypedValue<DataType>, undefined> {
    const freq = (freqArg as TypedValue<DataType.NUMBER>).value;
    async function* waveFunc(
      tArg: TypedValue<DataType>,
    ): AsyncGenerator<void, TypedValue<DataType>, undefined> {
      await Promise.resolve();
      const t = (tArg as TypedValue<DataType.NUMBER>).value;
      return { type: DataType.NUMBER, value: freq * t };
    }
    const wave = await dh.closure_make(
      { returnType: DataType.NUMBER, args: [DataType.NUMBER] },
      waveFunc,
    );
    return dh.pair_make(wave, durationArg);
  }
  const sineSound = await dh.closure_make(
    { returnType: DataType.PAIR, args: [DataType.NUMBER, DataType.NUMBER] },
    sineSoundFunc,
  );

  // play(sound) samples wave at t = 0, 1, 2 (via the module's own generic
  // closure_call_unchecked - the same protocol any real module uses, never
  // touching rt.callSync directly) and sums the results.
  async function* playFunc(
    soundArg: TypedValue<DataType>,
  ): AsyncGenerator<void, TypedValue<DataType>, undefined> {
    const sound = soundArg as TypedValue<DataType.PAIR>;
    const wave = (await dh.pair_head(sound)) as TypedValue<DataType.CLOSURE>;
    let total = 0;
    for (let t = 0; t < 3; t++) {
      const gen = dh.closure_call_unchecked(wave, [{ type: DataType.NUMBER, value: t }]);
      let step = await gen.next();
      while (!step.done) step = await gen.next();
      total += (step.value as TypedValue<DataType.NUMBER>).value;
    }
    return { type: DataType.NUMBER, value: total };
  }
  const play = await dh.closure_make(
    { returnType: DataType.NUMBER, args: [DataType.PAIR] },
    playFunc,
  );

  installFakeModule({
    sound: [
      { symbol: "sine_sound", value: sineSound },
      { symbol: "play", value: play },
    ],
  });

  const { session, outputs } = makeSession(dh);
  // wave(t) = 440 * t, sampled at t = 0, 1, 2 -> 0 + 440 + 880 = 1320
  await session.runChunk(
    "from sound import sine_sound, play\n" + "print(play(sine_sound(440, 2)))\n",
  );

  expect(outputs).toEqual(["1320.0"]);
});
