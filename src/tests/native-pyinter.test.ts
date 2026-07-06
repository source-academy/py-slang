import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NativePyinterError, runNativePyinter } from "../engines/svml/pyinter/native-pyinter";

/**
 * Stands in for the real native `runner` binary (which isn't available in
 * CI): a shell script that ignores its input and prints canned stdout,
 * matching runner.c's actual output contract.
 */
async function makeFakePyinter(
  stdout: string,
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), "fake-pyinter-"));
  const path = join(dir, "runner.sh");
  await writeFile(path, `#!/bin/sh\ncat <<'EOF'\n${stdout}\nEOF\n`);
  await chmod(path, 0o755);
  return { path, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

describe("runNativePyinter", () => {
  test("splits program output from the fault/result trailer", async () => {
    const { path, cleanup } = await makeFakePyinter(
      "hello\nworld\nProgram exited with fault no fault and result type integer: 42",
    );
    try {
      const result = await runNativePyinter(new Uint8Array([1, 2, 3]), path);
      expect(result.output).toBe("hello\nworld\n");
      expect(result.fault).toBe("no fault");
      expect(result.resultType).toBe("integer");
      expect(result.resultValue).toBe("42");
    } finally {
      await cleanup();
    }
  });

  test("reports a non-'no fault' fault", async () => {
    const { path, cleanup } = await makeFakePyinter(
      "Program exited with fault divide by zero and result type undefined: undefined",
    );
    try {
      const result = await runNativePyinter(new Uint8Array([1]), path);
      expect(result.fault).toBe("divide by zero");
      expect(result.output).toBe("");
    } finally {
      await cleanup();
    }
  });

  test("throws NativePyinterError when the trailer is missing", async () => {
    const { path, cleanup } = await makeFakePyinter("some unexpected output");
    try {
      await expect(runNativePyinter(new Uint8Array([1]), path)).rejects.toThrow(NativePyinterError);
    } finally {
      await cleanup();
    }
  });

  test("throws NativePyinterError when the binary can't be run", async () => {
    await expect(
      runNativePyinter(new Uint8Array([1]), "/nonexistent/path/to/runner"),
    ).rejects.toThrow(NativePyinterError);
  });
});
