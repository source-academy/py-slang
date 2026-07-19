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
