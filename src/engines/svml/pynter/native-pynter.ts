/**
 * Runs assembled SVML bytecode through a native Pynter `runner` binary
 * (https://github.com/source-academy/pynter), built separately via CMake.
 *
 * Pynter is a fork of Sinter (https://github.com/source-academy/sinter),
 * kept as a separate sister project so that giving the native VM
 * Python-specific semantics doesn't put any risk on Sinter, which remains
 * the fallback engine for the Source curriculum.
 *
 * The runner reads its program from a file path (it mmaps the file, so
 * stdin isn't an option) and always exits 0, appending one trailer line to
 * stdout of the form:
 *
 *   Program exited with fault <fault-name> and result type <type-name>: <value>
 *
 * everything before that line is the program's own print()/display() output.
 */

import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TRAILER_PREFIX = "Program exited with fault ";
const TRAILER_RE = /^Program exited with fault (.+?) and result type (.+?): ([\s\S]*)$/;

export interface NativePynterResult {
  /** Everything the program printed via print()/display(), concatenated. */
  output: string;
  /** e.g. "no fault", "divide by zero", "program called error()", ... */
  fault: string;
  resultType: string;
  resultValue: string;
}

export class NativePynterError extends Error {}

/**
 * Spawn `pynterPath` on `binary` and parse its stdout into program output
 * vs. the trailing fault/result diagnostic.
 */
export async function runNativePynter(
  binary: Uint8Array,
  pynterPath: string,
): Promise<NativePynterResult> {
  const dir = await mkdtemp(join(tmpdir(), "py-slang-svml-"));
  const programPath = join(dir, "program.svm");

  try {
    await writeFile(programPath, binary);

    const stdout = await new Promise<string>((resolve, reject) => {
      execFile(pynterPath, [programPath], (error, stdout, stderr) => {
        // The runner always exits 0 (faults are reported in stdout, not via
        // the exit code), so any error here means we couldn't run it at all.
        if (error) {
          reject(
            new NativePynterError(
              `Failed to run native pynter binary at "${pynterPath}": ${error.message}${
                stderr ? `\n${stderr}` : ""
              }`,
            ),
          );
          return;
        }
        resolve(stdout);
      });
    });

    const trailerStart = stdout.lastIndexOf(TRAILER_PREFIX);
    if (trailerStart === -1) {
      throw new NativePynterError(
        `Unexpected output from native pynter binary (no fault/result trailer found):\n${stdout}`,
      );
    }

    const output = stdout.slice(0, trailerStart);
    const trailer = stdout.slice(trailerStart).trimEnd();
    const match = TRAILER_RE.exec(trailer);
    if (!match) {
      throw new NativePynterError(`Could not parse native pynter trailer line: ${trailer}`);
    }
    const [, fault, resultType, resultValue] = match;

    return { output, fault, resultType, resultValue };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
