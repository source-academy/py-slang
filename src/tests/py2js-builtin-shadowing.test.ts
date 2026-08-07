/**
 * py2js#415: a name a chunk assigns anywhere at module level (a `def`, or a
 * plain `=`) must still resolve to the real builtin of the same name for any
 * read *before* that assignment actually executes — CPython resolves a
 * module-level name dynamically, checking globals() then builtins() at the
 * point of each read, never statically ahead of time. `runCode` (the CSE
 * machine) already gets this right and is used here as the reference oracle,
 * the same way py2js-global-nonlocal.test.ts does for `global`/`nonlocal`.
 *
 * `compileProgram`'s builtin preamble (compiler.ts) skips a hoisted
 * `const $name = __py.builtins[name]` binding for any name the chunk itself
 * assigns anywhere at module level, so a *later* read (once the assignment
 * has run) correctly sees the local binding — but before this fix, an
 * *earlier* read had nothing to fall back to and raised a spurious NameError
 * instead of finding the still-current builtin, in both program mode
 * (compiler.ts's `pgref`) and REPL mode (runtime.ts's `gref`).
 */
import { Py2JsSession, runCodePy2Js } from "../engines/py2js";
import { runCode } from "../runner";

const code =
  "real_print = print\nprint(1)\n\ndef print(x):\n    return x + 100\n\nreal_print(print(4))\n";

test("a read before the shadowing def runs still resolves to the real builtin (CSE reference)", async () => {
  await expect(runCode(code, 1)).resolves.not.toThrow();
});

test("program mode: print(1) uses the real builtin, print(4) uses the later local def", () => {
  expect(runCodePy2Js(code, 1).output).toBe("1\n104\n");
});

test("REPL mode: same, through Py2JsSession.runChunk", async () => {
  const outputs: string[] = [];
  const session = new Py2JsSession(1, { onOutput: line => outputs.push(line) });
  await session.runChunk(code);
  expect(outputs).toEqual(["1", "104"]);
});

test("the fallback also applies to a bridged stdlib builtin, not just a native one like print", () => {
  const bridgedCode =
    "y = abs(-5)\n\ndef abs(x):\n    return 'fake'\n\nz = abs(-5)\nprint(y)\nprint(z)\n";
  expect(runCodePy2Js(bridgedCode, 1).output).toBe("5\nfake\n");
});

test("chapter 3+ behaves identically (reassignment being generally legal there doesn't change this)", () => {
  expect(runCodePy2Js(code, 3).output).toBe("1\n104\n");
});
