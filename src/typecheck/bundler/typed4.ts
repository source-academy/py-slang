/**
 * Builds the worker of the Python §4 Typed checker (dist/TypedPy4Checker.js): pyright with Source
 * Python's typeshed, the prelude and the configuration embedded. See bundle.ts. Used by
 * scripts/build-typecheck.ts, and by the tests, which build it when it is missing or out of date.
 *
 * Paths are relative to the working directory, which is the root of the repository when this runs.
 */
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "fs";
import { createRequire } from "module";
import { dirname, resolve } from "path";
import { parse } from "acorn";
import { TYPED_PYTHON_4_CONFIG } from "../config";
import { WORKSPACE_ROOT } from "../constants";
import { buildWorkerBundle, patchBoolOperandChecks, readWorkerBundle } from "./bundle";
import { patchSourceBuiltins, patchSourceTypes } from "./source-builtins";

export const TYPED_PY4_CHECKER_FILE = "dist/TypedPy4Checker.js";

/** The modules whose standard library stubs are kept: what the builtins need, and what typing needs. */
const STDLIB_ROOTS = [
  "builtins",
  "typing",
  "typing_extensions",
  "_typeshed",
  "types",
  "collections.abc",
];

/** The files that the build is made of: the worker is out of date when one of them changes. */
const SOURCES = [
  "src/typecheck/prelude.pyi",
  "src/typecheck/config.ts",
  "src/typecheck/constants.ts",
  "src/typecheck/bundler/bundle.ts",
  "src/typecheck/bundler/source-builtins.ts",
  "src/typecheck/bundler/typed4.ts",
];

const STAMP = "/* typed-python-4-checker:";

function pyrightWorkerFile(): string {
  const require = createRequire(resolve("package.json"));
  return require.resolve("browser-basedpyright/dist/pyright.worker.js");
}

function stampOf(workerFile: string): string {
  const hash = createHash("sha256");
  hash.update(readFileSync(workerFile));
  for (const file of SOURCES) hash.update(readFileSync(resolve(file)));
  return hash.digest("hex").slice(0, 16);
}

/** Whether the worker in `file` is there and was built from the current sources. */
export function isTypedPython4CheckerFresh(file: string = TYPED_PY4_CHECKER_FILE): boolean {
  const out = resolve(file);
  if (!existsSync(out)) return false;
  const stamp = `${STAMP}${stampOf(pyrightWorkerFile())} */`;
  return readFileSync(out, "utf8").trimEnd().endsWith(stamp);
}

export interface BuildReport {
  /** False when the file was up to date. */
  built: boolean;
  file: string;
  bytes: number;
  kept?: number;
  dropped?: number;
}

/** Builds the worker if it is missing or out of date (or if `force`); writes it atomically. */
export function buildTypedPython4Checker(
  file: string = TYPED_PY4_CHECKER_FILE,
  { force = false }: { force?: boolean } = {},
): BuildReport {
  const out = resolve(file);
  const workerFile = pyrightWorkerFile();
  const stamp = `${STAMP}${stampOf(workerFile)} */`;

  if (!force && existsSync(out)) {
    const text = readFileSync(out, "utf8");
    if (text.trimEnd().endsWith(stamp)) return { built: false, file: out, bytes: text.length };
  }
  return build(out, stamp);
}

function build(out: string, stamp: string): BuildReport {
  const workerFile = pyrightWorkerFile();

  const bundle = readWorkerBundle(readFileSync(workerFile, "utf8"));
  const original = (path: string) => {
    const entry = bundle.files.get(path);
    if (!entry) throw new Error(`typeshed has no ${path}`);
    return entry.text;
  };
  const result = buildWorkerBundle(bundle, {
    stdlibRoots: STDLIB_ROOTS,
    replace: {
      "stdlib/builtins.pyi": patchSourceBuiltins(original("stdlib/builtins.pyi")),
      "stdlib/types.pyi": patchSourceTypes(original("stdlib/types.pyi")),
    },
    add: {
      [`${WORKSPACE_ROOT}/__builtins__.pyi`]: readFileSync(
        resolve("src/typecheck/prelude.pyi"),
        "utf8",
      ),
      [`${WORKSPACE_ROOT}/pyrightconfig.json`]: JSON.stringify(TYPED_PYTHON_4_CONFIG),
    },
  });

  result.source = patchBoolOperandChecks(result.source);

  // The edits are text surgery on 18 MB of generated JavaScript: check that the result still parses.
  parse(result.source, { ecmaVersion: "latest", sourceType: "script" });

  // The map of the worker's source is not shipped: do not point devtools at it.
  const source = result.source.replace(/\n\/\/# sourceMappingURL=\S*\s*$/, "\n");
  const text = `${source}\n${stamp}\n`;
  mkdirSync(dirname(out), { recursive: true });
  const temporary = `${out}.${process.pid}.tmp`;
  writeFileSync(temporary, text);
  renameSync(temporary, out);
  return { built: true, file: out, bytes: text.length, kept: result.kept, dropped: result.dropped };
}

/**
 * The worker, built if it is missing or out of date, for the callers that may run at the same time
 * (the test files, in different processes): one of them builds it while the others wait for it.
 */
export async function ensureTypedPython4Checker(
  file: string = TYPED_PY4_CHECKER_FILE,
  { timeoutMs = 300_000 }: { timeoutMs?: number } = {},
): Promise<string> {
  const out = resolve(file);
  if (isTypedPython4CheckerFresh(file)) return out;
  const lock = `${out}.lock`;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    mkdirSync(dirname(out), { recursive: true });
    try {
      mkdirSync(lock); // fails if another process holds the lock
    } catch {
      if (isTypedPython4CheckerFresh(file)) return out;
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${lock}`);
      await new Promise(done => setTimeout(done, 200));
      continue;
    }
    try {
      buildTypedPython4Checker(file);
      return out;
    } finally {
      rmSync(lock, { recursive: true, force: true });
    }
  }
}
