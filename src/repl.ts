/**
 * Standalone CLI for py-slang.
 *
 * Usage:
 *   yarn build:repl && yarn repl <file.py> [-v <1-4>]
 *   yarn repl <file.py> --engine pvml --pynter <path-to-pynter-runner-binary> -v 3
 *   yarn repl <file.py> --engine pvml-browser [-v <1-4>]
 *
 * Runs a SICPy program through one of three engines:
 *   - cse (default): the tree-walking CSE evaluator.
 *   - pvml: compiles to PVML bytecode and executes it on a native Pynter
 *     `runner` binary (https://github.com/source-academy/pynter, built
 *     separately via CMake). Pynter is a fork of Sinter
 *     (https://github.com/source-academy/sinter) kept as a separate project
 *     so that Python-specific VM semantics don't risk destabilizing Sinter,
 *     which remains the fallback engine for the Source curriculum. Only
 *     supports §3 (-v 3), and requires --pynter <path>.
 *   - pvml-browser: compiles to PVML bytecode and executes it directly on
 *     PVMLInterpreter, the pure-TypeScript "PVML-in-browser" VM (no WASM, no
 *     native binary — the same engine PyPvmlEvaluator1..4 use in the
 *     Conductor pathway). Supports all four SICPy chapters (-v 1-4).
 *
 * The engine can also be set via the PY_SLANG_ENGINE environment variable
 * (e.g. `PY_SLANG_ENGINE=pvml-browser yarn repl file.py`); an explicit
 * --engine flag takes precedence over it.
 *
 * Writes output to stdout. Variant maps to SICPy chapter (1–4); defaults to 4.
 */

import { readFileSync } from "fs";
import { Command } from "commander";
import { runCodePvml, runCodePvmlInterpreter } from "./pvml-runner";
import { RunError, runCode } from "./runner";

type Engine = "cse" | "pvml" | "pvml-browser";

const ENGINES: Engine[] = ["cse", "pvml", "pvml-browser"];

interface ReplOptions {
  variant: string;
  engine: Engine;
  pynter?: string;
}

async function runFile(filename: string, opts: ReplOptions): Promise<void> {
  let code: string;
  try {
    code = readFileSync(filename, "utf-8");
  } catch {
    process.stderr.write(`Cannot read file: ${filename}\n`);
    process.exit(1);
  }

  const variant = parseInt(opts.variant, 10);

  if (opts.engine === "pvml" && !opts.pynter) {
    process.stderr.write(
      "--engine pvml requires --pynter <path>, pointing at a built native Pynter `runner`" +
        " binary (see https://github.com/source-academy/pynter#build-locally). To run PVML" +
        " bytecode without a native binary, use --engine pvml-browser instead.\n",
    );
    process.exit(1);
  }

  if (opts.engine === "pvml" && variant !== 3) {
    process.stderr.write(
      `--engine pvml only supports SICPy §3 (got -v ${opts.variant}). Pass -v 3, use --engine pvml-browser (supports §1-4), or drop --engine to use the CSE evaluator instead.\n`,
    );
    process.exit(1);
  }

  try {
    const output =
      opts.engine === "pvml"
        ? await runCodePvml(code, variant, { pynterPath: opts.pynter! })
        : opts.engine === "pvml-browser"
          ? await runCodePvmlInterpreter(code, variant)
          : await runCode(code, variant);
    process.stdout.write(output);
  } catch (e) {
    if (e instanceof RunError) {
      process.stderr.write(e.message + "\n");
    } else {
      process.stderr.write(String(e) + "\n");
    }
    process.exit(1);
  }
}

const envEngine = process.env.PY_SLANG_ENGINE;

const program = new Command()
  .name("py-slang")
  .description(
    "Run SICPy programs using the py-slang CSE, PVML/Pynter, or PVML-in-browser evaluator",
  )
  .argument("<file>", "SICPy source file to evaluate")
  .option("-v, --variant <number>", "SICPy chapter/variant (1–4)", "4")
  .option(
    "-e, --engine <name>",
    "Execution engine: cse, pvml, or pvml-browser (default: $PY_SLANG_ENGINE, or cse)",
    envEngine ?? "cse",
  )
  .option(
    "--pynter <path>",
    "Path to a native Pynter `runner` binary (required for --engine pvml, which only supports -v 3)",
  )
  .action(async (file: string, opts: ReplOptions) => {
    if (!ENGINES.includes(opts.engine)) {
      process.stderr.write(
        `Invalid engine: ${opts.engine}. Expected one of: ${ENGINES.join(", ")}.\n`,
      );
      process.exit(1);
    }
    await runFile(file, opts);
  });

program.parse();
