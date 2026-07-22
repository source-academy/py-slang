/**
 * set_timeout(f, t) / clear_all_timeout() (source-academy/py-slang#311):
 * schedules f() to run t milliseconds later without blocking the caller,
 * moved into the language itself (misc.ts's MISC group) rather than staying
 * gated behind importing the sound_matrix module, whose own set_timeout(f, t)
 * this matches (same signature, same units).
 *
 * py2js needs no cold-callback re-entry support to make this work: a
 * compiled Python function already is a plain JS closure, so the real
 * `setTimeout` in runtime.ts's builtin just calls it (via `rt.acall`, the
 * async trampoline — so a callback that itself needs a frontend round-trip
 * still works) directly on the real event loop — see the doc comment on
 * set_timeout in src/engines/py2js/runtime.ts. Uses Jest's fake timers
 * throughout so the suite stays fast and deterministic instead of waiting on
 * real delays; advanceTimersByTimeAsync (not the sync variant) is required
 * since firing a callback now always goes through at least one microtask.
 */
import { DataType, TypedValue } from "@sourceacademy/conductor/types";
import { ModuleLoaderRunnerPlugin } from "@sourceacademy/runner-module-loader";
import { GenericDataHandler } from "../conductor/GenericDataHandler";
import { Py2JsSession, runCodePy2Js } from "../engines/py2js";

function makeSession(variant = 1, dataHandler?: GenericDataHandler) {
  const outputs: string[] = [];
  const session = new Py2JsSession(variant, { onOutput: line => outputs.push(line), dataHandler });
  return { session, outputs };
}

/** Mirrors py2js-from-import.test.ts's installFakeModule: installs a fake
 * conductor module so `from X import y` resolves without a real plugin. */
function installFakeModule(exportsByModule: Record<string, { symbol: string; value: unknown }[]>) {
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

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test("fires the callback only after the delay elapses, not before", async () => {
  const { session, outputs } = makeSession();
  await session.runChunk(`
def later():
    print("second")

print("first")
set_timeout(later, 100)
print("third")
`);
  expect(outputs).toEqual(["first", "third"]);
  await jest.advanceTimersByTimeAsync(99);
  expect(outputs).toEqual(["first", "third"]);
  await jest.advanceTimersByTimeAsync(1);
  expect(outputs).toEqual(["first", "third", "second"]);
});

test("multiple scheduled callbacks fire in delay order", async () => {
  const { session, outputs } = makeSession();
  await session.runChunk(`
def a():
    print("a")
def b():
    print("b")

set_timeout(a, 200)
set_timeout(b, 50)
`);
  await jest.advanceTimersByTimeAsync(200);
  expect(outputs).toEqual(["b", "a"]);
});

test("clear_all_timeout cancels every pending callback", async () => {
  const { session, outputs } = makeSession();
  await session.runChunk(`
def later():
    print("should not appear")

set_timeout(later, 100)
clear_all_timeout()
`);
  await jest.advanceTimersByTimeAsync(10_000);
  expect(outputs).toEqual([]);
});

test("an error raised inside a scheduled callback is reported, not swallowed", async () => {
  const { session, outputs } = makeSession();
  await session.runChunk(`
def boom():
    1 / 0

set_timeout(boom, 50)
`);
  await jest.advanceTimersByTimeAsync(50);
  expect(outputs.some(line => line.includes("ZeroDivisionError"))).toBe(true);
});

test("set_timeout requires a callable first argument", () => {
  expect(() => runCodePy2Js("set_timeout(1, 10)", 1)).toThrow(/TypeError/);
});

test("set_timeout requires a numeric second argument", () => {
  expect(() =>
    runCodePy2Js(`def f():\n    pass\nset_timeout(f, 'soon')`, 1),
  ).toThrow(/TypeError/);
});

test("clear_all_timeout takes no arguments", () => {
  expect(() => runCodePy2Js("clear_all_timeout(1)", 1)).toThrow(/TypeError/);
});

test("a scheduled callback can itself call an imported module function needing a frontend round-trip", async () => {
  // The scenario motivating rt.acall over rt.call in set_timeout's builtin
  // (runtime.ts): `double` crosses the module boundary as an asyncOnly
  // PyFunction (see moduleInterop.ts) — only callable via the async
  // trampoline. `later` is defined in this same chunk, which imports
  // `double`, so the whole chunk (and later's own compiled body) is in dual
  // mode, exactly as a real sound_matrix-calling-back-into-Python program
  // would be.
  const dh = new GenericDataHandler();
  async function* doubleFunc(
    x: TypedValue<DataType>,
  ): AsyncGenerator<void, TypedValue<DataType>, undefined> {
    await Promise.resolve(); // conductor's ExternCallable contract requires an async generator
    return { type: DataType.NUMBER, value: (x as TypedValue<DataType.NUMBER>).value * 2 };
  }
  const double = await dh.closure_make({ returnType: DataType.NUMBER, args: [DataType.NUMBER] }, doubleFunc);
  installFakeModule({ physics: [{ symbol: "double", value: double }] });

  const { session, outputs } = makeSession(2, dh);
  await session.runChunk(
    "from physics import double\n" +
      "def later():\n" +
      "    print(double(21))\n" +
      "set_timeout(later, 50)\n",
  );
  expect(outputs).toEqual([]);
  await jest.advanceTimersByTimeAsync(50);
  expect(outputs).toEqual(["42.0"]);
});
