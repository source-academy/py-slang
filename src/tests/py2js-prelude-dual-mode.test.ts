/**
 * Group preludes (linked-list.prelude.ts's map/filter/reduce, etc.) used to
 * always compile sync-only: nothing in the prelude's own source imports
 * anything or calls input(), so there seemed to be no reason for it to need
 * the async spine even when the program using it does (see the removed
 * comment this replaced, in setupRuntime/Py2JsSession.runChunkInternal).
 *
 * That reasoning missed a case: reduce/_reduce (and map/_map, filter/_filter,
 * ...) call a *caller-supplied* callback. A sync-compiled function's own
 * calls always go through `__py.call` (compiler.ts's mode doc), regardless
 * of how the function itself was invoked - so reduce's call to its callback
 * was pinned onto the synchronous trampoline even when reduce was invoked
 * from a program running on the async spine. Any module call inside that
 * callback then hit "needs a frontend round-trip and cannot be called from a
 * synchronous module callback", not because the module call itself lacked
 * async support, but because reduce's own internal dispatch never gave it
 * the chance - source-academy/modules#944's `consecutively(llist(...))`
 * (get_wave/get_duration called inside a callback threaded through reduce)
 * is the motivating real-world case.
 *
 * Fix: both prelude-compilation call sites (setupRuntime's one-shot API,
 * Py2JsSession.runChunkInternal's persistent-session API used by the
 * conductor evaluator) now compile the prelude in "dual" mode too, so a
 * caller-supplied callback rides whichever spine reduce itself was invoked
 * on - `await __py.acall` when reduce runs via the program's own async
 * dispatch, `__py.call` unchanged when reduce is invoked synchronously
 * (e.g. via callSync from a TS module, matching def2's existing contract).
 */
import { PyValue, runCodePy2Js, runCodePy2JsDual, Py2JsRuntime, Py2JsSession } from "../engines/py2js";

test("a callback passed through reduce can still reach an async-only builtin (one-shot API)", async () => {
  const code = `def combine(a, b):
    return a + b + slow_thing()
print(reduce(combine, 0, llist(1, 2, 3)))`;

  const { output } = await runCodePy2JsDual(code, 2, {
    extraBuiltins: (_rt: Py2JsRuntime) => {
      const slowThing = (() => Promise.resolve(10n)) as unknown as PyValue & { asyncOnly?: boolean };
      slowThing.asyncOnly = true;
      return { slow_thing: slowThing as unknown as PyValue };
    },
  });

  // 1+2+3 (the elements) + 3 * 10 (one asyncOnly call per element)
  expect(output).toBe("36\n");
});

test("a callback passed through reduce still runs on the synchronous trampoline when reduce itself is called synchronously", () => {
  // Guards against overcorrecting: reduce must still work, unchanged, when
  // invoked from a genuinely synchronous context (e.g. sampled via
  // callSync from a TS module) - dual-compiling the prelude must not force
  // every reduce call onto the async spine regardless of how it's invoked.
  const code = `def square(x):
    return x * x
def combine(a, b):
    return square(a) + b
print(reduce(combine, 0, llist(1, 2, 3)))`;

  const { output } = runCodePy2Js(code, 2);
  expect(output).toBe("14\n");
});

test("a callback reaching an async-only builtin through TWO levels of user-function indirection (matching the real modules#944 shape) still works", async () => {
  // reduce's callback (combine) itself calls another plain user function
  // (helper) which is what actually reaches the module-like builtin -
  // mirrors reduce -> the student's own callback -> two_consecutively ->
  // get_duration in the original bug report.
  const code = `def helper(a, b):
    return a + b + slow_thing()

def combine(a, b):
    return helper(a, b)
print(reduce(combine, 0, llist(1, 2, 3)))`;

  const { output } = await runCodePy2JsDual(code, 2, {
    extraBuiltins: (_rt: Py2JsRuntime) => {
      const slowThing = (() => Promise.resolve(10n)) as unknown as PyValue & { asyncOnly?: boolean };
      slowThing.asyncOnly = true;
      return { slow_thing: slowThing as unknown as PyValue };
    },
  });

  expect(output).toBe("36\n");
});

test("Py2JsSession (the conductor evaluator's own persistent-session API) propagates the same fix", async () => {
  const outputs: string[] = [];
  let probeCalls = 0;

  const session = new Py2JsSession(2, {
    onOutput: line => outputs.push(line),
    extraBuiltins: (_rt: Py2JsRuntime) => {
      const probe = (() => {
        throw new Error("sync body was called - reduce's callback did not ride the async spine");
      }) as unknown as PyValue & { asyncBody?: (...args: PyValue[]) => Promise<PyValue> };
      probe.asyncBody = () => {
        probeCalls++;
        return Promise.resolve(100n);
      };
      return { probe: probe as unknown as PyValue };
    },
  });

  // A static (never-executed) reference to input() forces this chunk onto
  // the dual/async spine, exactly like a real `from sound import (...)`
  // does in the original bug report - see runChunkInternal's own doc
  // comment on referencedNames.has("input").
  const code = `def _unused():
    return input()

def combine(a, b):
    return probe() + b
print(reduce(combine, 0, llist(1, 2, 3)))`;

  await session.runChunk(code);

  // onOutput delivers each print()'d line without its trailing newline
  // (unlike the sync/one-shot API's own `output` buffer).
  expect(outputs.join("")).toBe("300");
  expect(probeCalls).toBe(3);
});
