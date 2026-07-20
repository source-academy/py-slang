/**
 * Dual-compilation mode (compiler.ts's "dual" mode): every user function gets
 * two bodies over one closure environment — an async body for the program's
 * spine (module round-trips can await) and a sync body a TS module calls
 * back into at full speed via Py2JsRuntime.callSync (e.g. sampling a sound
 * wave 44,100 times/sec, the PR's motivating use case). Neither
 * runCodePy2JsDual nor the def2/acall/callSync machinery it relies on had any
 * test before this file.
 */
import {
  PyValue,
  Py2JsRunError,
  Py2JsRuntime,
  runCodePy2Js,
  runCodePy2JsDual,
} from "../engines/py2js";

test("dual mode produces the same output as sync mode for a plain program", async () => {
  const code = `def square(x):
    return x * x
print(square(6))`;
  const sync = runCodePy2Js(code, 1).output;
  const dual = (await runCodePy2JsDual(code, 1)).output;
  expect(dual).toBe("36\n");
  expect(dual).toBe(sync);
});

test("an error raised while the program runs is wrapped as Py2JsRunError with kind 'runtime', same as sync mode", async () => {
  // py2js-control-flow.test.ts covers this for runCodePy2Js's catch (index.ts);
  // runCodePy2JsDual has the identical catch around the async spine, which had
  // no test of its own before this.
  await expect(runCodePy2JsDual("print(1 / 0)\n", 1)).rejects.toMatchObject({
    name: "Py2JsRunError",
    kind: "runtime",
  });
  try {
    await runCodePy2JsDual("print(1 / 0)\n", 1);
    throw new Error("expected runCodePy2JsDual to throw");
  } catch (e) {
    expect(e).toBeInstanceOf(Py2JsRunError);
    expect((e as Py2JsRunError).message).toContain("ZeroDivisionError");
  }
});

test("deep tail recursion on the async spine does not grow the JS call stack", async () => {
  const code = `def count(n, acc):
    return acc if n == 0 else count(n - 1, acc + n)
print(count(100000, 0))`;
  const { output } = await runCodePy2JsDual(code, 1);
  expect(output).toBe("5000050000\n");
});

test("a host module calls back into a Python function synchronously via callSync (def2's sync body)", async () => {
  // Mirrors the PR's headline scenario: a module invokes a compiled Python
  // function many times through a plain synchronous callback rather than the
  // async spine — this is what makes that callback cheap.
  const sampled: PyValue[] = [];
  const code = `def square(x):
    return x * x
sample(square, 3)`;

  const { output } = await runCodePy2JsDual(code, 1, {
    extraBuiltins: (rt: Py2JsRuntime) => ({
      sample: ((fn: PyValue, n: PyValue) => {
        for (let i = 0n; i < (n as bigint); i++) {
          sampled.push(rt.callSync(fn, [i]));
        }
        return null;
      }) as unknown as PyValue,
    }),
  });

  expect(output).toBe("");
  expect(sampled).toEqual([0n, 1n, 4n]);
});

test("an asyncOnly builtin rejects being called from the synchronous callSync boundary", async () => {
  // asyncOnly marks module functions that need a frontend round-trip; the
  // sync trampoline (callSync/call) must refuse them rather than silently
  // handing back an unawaited Promise.
  const code = `def wrapper():
    return slow_thing()
sample(wrapper)`;
  let caught: unknown;

  const { output } = await runCodePy2JsDual(code, 1, {
    extraBuiltins: (rt: Py2JsRuntime) => {
      const slowThing = (() => 999n) as unknown as PyValue & { asyncOnly?: boolean };
      slowThing.asyncOnly = true;
      return {
        slow_thing: slowThing as unknown as PyValue,
        sample: ((fn: PyValue) => {
          try {
            rt.callSync(fn, []);
          } catch (e) {
            caught = e;
          }
          return null;
        }) as unknown as PyValue,
      };
    },
  });

  expect(output).toBe("");
  expect(caught).toBeInstanceOf(Error);
  expect((caught as Error).message).toContain(
    "slow_thing() needs a frontend round-trip and cannot be called from a synchronous module callback",
  );
});
