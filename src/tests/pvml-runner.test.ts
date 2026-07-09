import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runCodePvml,
  runCodePvmlInterpreter,
  runCodePvmlInterpreterDetailed,
} from "../pvml-runner";
import { RunError } from "../runner";

/**
 * Stands in for the real native `runner` binary (which isn't available in
 * CI): a shell script that ignores its input and prints canned stdout,
 * matching runner.c's actual output contract. Since this test isn't
 * exercising real PVML semantics, the canned output doesn't need to match
 * what the source actually computes -- it only exercises runCodePvml's
 * wiring (compile -> assemble -> spawn -> parse result).
 */
async function makeFakePynter(
  stdout: string,
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), "fake-pynter-"));
  const path = join(dir, "runner.sh");
  await writeFile(path, `#!/bin/sh\ncat <<'EOF'\n${stdout}\nEOF\n`);
  await chmod(path, 0o755);
  return { path, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

describe("runCodePvml", () => {
  test("returns program output on success", async () => {
    const { path, cleanup } = await makeFakePynter(
      "hello\nProgram exited with fault no fault and result type undefined: undefined",
    );
    try {
      const output = await runCodePvml('print("hello")\n', 3, { pynterPath: path });
      expect(output).toBe("hello\n");
    } finally {
      await cleanup();
    }
  });

  test("throws a parse RunError on invalid syntax", async () => {
    await expect(runCodePvml("def (:\n", 3, { pynterPath: "/unused" })).rejects.toMatchObject({
      kind: "parse",
    } satisfies Partial<RunError>);
  });

  test("throws a runtime RunError when Pynter reports a fault", async () => {
    const { path, cleanup } = await makeFakePynter(
      "Program exited with fault divide by zero and result type undefined: undefined",
    );
    try {
      await expect(runCodePvml("1 / 0\n", 3, { pynterPath: path })).rejects.toMatchObject({
        kind: "runtime",
      } satisfies Partial<RunError>);
    } finally {
      await cleanup();
    }
  });
});

// "PVML-in-browser": PVMLInterpreter (pure TS, no native binary), the same
// engine PyPvmlEvaluator1..4 use — see repl.ts's --engine pvml-browser.
describe("runCodePvmlInterpreter / runCodePvmlInterpreterDetailed", () => {
  test("returns program output on success", async () => {
    const output = await runCodePvmlInterpreter('print("hello")\n', 4);
    expect(output).toBe("hello\n");
  });

  test("each print() call is its own newline-terminated line, matching runCode()'s CSE output", async () => {
    // Regression test: PVMLInterpreter's print primitive deliberately omits
    // the trailing newline itself (see pvml-interpreter.test.ts's "multiple
    // print calls"); runCodePvmlInterpreterDetailed must add it back, or
    // consecutive print() calls run together with no separator.
    const output = await runCodePvmlInterpreter('print("a")\nprint("b")\nprint(1 + 2)\n', 4);
    expect(output).toBe("a\nb\n3\n");
  });

  test("reports the program's final value alongside its output", async () => {
    const { output, result } = await runCodePvmlInterpreterDetailed("1 + 2\n", 4);
    expect(output).toBe("");
    expect(result).toBe(3n);
  });

  test("supports all four SICPy chapters, each with its own group's prelude available", async () => {
    // §2+: linked-list's pair()/head() come from linked-list.prelude.ts, not
    // a TS primitive -- this exercises prelude loading, not just the compiler.
    await expect(runCodePvmlInterpreter("pair(1, 2)\n", 2)).resolves.toBe("");
    // §3: list literals.
    await expect(runCodePvmlInterpreter("[1, 2, 3][1]\n", 3)).resolves.toBe("");
    // §4: `is`, closures unrestricted at module scope.
    const output = await runCodePvmlInterpreter(
      "def f():\n    return 1\nf() is f()\nprint('ok')\n",
      4,
    );
    expect(output).toBe("ok\n");
  });

  test("throws an analysis RunError for a feature not allowed at the given chapter", async () => {
    // List literals are rejected at §1/§2 (see makeValidatorsForChapter).
    await expect(runCodePvmlInterpreter("[1, 2, 3]\n", 1)).rejects.toMatchObject({
      kind: "analysis",
    } satisfies Partial<RunError>);
  });

  test("throws a parse RunError on invalid syntax", async () => {
    await expect(runCodePvmlInterpreter("def (:\n", 4)).rejects.toMatchObject({
      kind: "parse",
    } satisfies Partial<RunError>);
  });

  test("throws a runtime RunError on a genuine runtime error", async () => {
    await expect(runCodePvmlInterpreter("1 / 0\n", 4)).rejects.toMatchObject({
      kind: "runtime",
    } satisfies Partial<RunError>);
  });
});
