/**
 * CPython as the reference of the full e-stepper's tests: runs a program with `python3` and reports
 * what it printed and the name of the exception that stopped it (if any).
 */

import { spawnSync } from "child_process";

export const cpythonAvailable: boolean = (() => {
  try {
    return spawnSync("python3", ["--version"]).status === 0;
  } catch {
    return false;
  }
})();

const WRAPPER = `
import sys
source = sys.stdin.read()
try:
    exec(compile(source, "<program>", "exec"), {"__name__": "__main__"})
except BaseException as e:
    sys.stdout.flush()
    sys.stderr.write("@@ERROR " + type(e).__name__)
`;

export interface Outcome {
  output: string;
  /** The name of the exception, or null. */
  error: string | null;
}

/** CPython reports bad indentation as subclasses of SyntaxError; so does the engine. */
export function normalizeKind(kind: string | null): string | null {
  return kind === "IndentationError" || kind === "TabError" ? "SyntaxError" : kind;
}

export function cpython(code: string): Outcome {
  const result = spawnSync("python3", ["-I", "-c", WRAPPER], {
    input: code,
    encoding: "utf8",
    timeout: 30_000,
  });
  const marker = /@@ERROR (\w+)/.exec(result.stderr);
  return { output: result.stdout, error: normalizeKind(marker ? marker[1] : null) };
}
