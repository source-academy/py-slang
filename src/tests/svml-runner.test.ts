import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RunError } from "../runner";
import { runCodeSvml } from "../svml-runner";

/**
 * Stands in for the real native `runner` binary (which isn't available in
 * CI): a shell script that ignores its input and prints canned stdout,
 * matching runner.c's actual output contract. Since this test isn't
 * exercising real SVML semantics, the canned output doesn't need to match
 * what the source actually computes -- it only exercises runCodeSvml's
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

describe("runCodeSvml", () => {
  test("returns program output on success", async () => {
    const { path, cleanup } = await makeFakePynter(
      "hello\nProgram exited with fault no fault and result type undefined: undefined",
    );
    try {
      const output = await runCodeSvml('print("hello")\n', 2, { pynterPath: path });
      expect(output).toBe("hello\n");
    } finally {
      await cleanup();
    }
  });

  test("throws a parse RunError on invalid syntax", async () => {
    await expect(runCodeSvml("def (:\n", 2, { pynterPath: "/unused" })).rejects.toMatchObject({
      kind: "parse",
    } satisfies Partial<RunError>);
  });

  test("throws a runtime RunError when Pynter reports a fault", async () => {
    const { path, cleanup } = await makeFakePynter(
      "Program exited with fault divide by zero and result type undefined: undefined",
    );
    try {
      await expect(runCodeSvml("1 / 0\n", 2, { pynterPath: path })).rejects.toMatchObject({
        kind: "runtime",
      } satisfies Partial<RunError>);
    } finally {
      await cleanup();
    }
  });
});
