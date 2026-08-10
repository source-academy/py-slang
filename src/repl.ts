/**
 * Standalone CLI for py-slang.
 *
 * Usage:
 *   yarn build:repl && yarn repl <file.py> [-v <1-4>]
 *   yarn repl <file.py> --engine pynter --pynter <path-to-pynter-runner-binary> -v 3
 *   yarn repl <file.py> --engine pvml [-v <1-4>]
 *   yarn repl <file.py> --engine py2js [-v <1-4>]
 *   yarn repl <file.py> --engine wasm [-v <1-4>]
 *
 * Runs a SICPy program through one of five engines:
 *   - cse (default): the tree-walking CSE evaluator.
 *   - pynter: compiles to PVML bytecode and executes it on a native Pynter
 *     `runner` binary (https://github.com/source-academy/pynter, built
 *     separately via CMake). Pynter is a fork of Sinter
 *     (https://github.com/source-academy/sinter) kept as a separate project
 *     so that Python-specific VM semantics don't risk destabilizing Sinter,
 *     which remains the fallback engine for the Source curriculum. Only
 *     supports §3 (-v 3), and requires --pynter <path>.
 *   - pvml: compiles to PVML bytecode and executes it directly on
 *     PVMLInterpreter, the pure-TypeScript "PVML-in-browser" VM (no WASM, no
 *     native binary — the same engine PyPvmlEvaluator1..4 use in the
 *     Conductor pathway). Supports all four SICPy chapters (-v 1-4).
 *   - py2js: compiles to JavaScript and runs it directly (src/engines/py2js)
 *     — the same engine Py2JsEvaluator1..4 use in the Conductor pathway.
 *     Supports all four SICPy chapters (-v 1-4). Runs in sync mode (via
 *     runCodePy2Js), so a program with a local import (`from .foo import x`)
 *     is not supported from this CLI — only Py2JsSession's dual/async mode
 *     handles those.
 *   - wasm: compiles to an actual WebAssembly module (src/engines/wasm) and
 *     runs it via Node's built-in WebAssembly support — the same compiler
 *     PyWasmEvaluator1..4 use in the Conductor pathway. Supports all four
 *     SICPy chapters (-v 1-4).
 *
 * The engine can also be set via the PY_SLANG_ENGINE environment variable
 * (e.g. `PY_SLANG_ENGINE=pvml yarn repl file.py`); an explicit --engine flag
 * takes precedence over it.
 *
 * Writes output to stdout. Variant maps to SICPy chapter (1–4); defaults to 4.
 */

import { readFileSync } from "fs";
import { Command } from "commander";
import { runCodePy2Js } from "./engines/py2js";
import { compileToWasmAndRun } from "./engines/wasm";
import { runCodePvml, runCodePvmlInterpreter } from "./pvml-runner";
import { runCode } from "./runner";
import linkedList from "./stdlib/linked-list";
import list from "./stdlib/list";
import pairmutator from "./stdlib/pairmutator";
import mce from "./stdlib/parser";
import type { Group } from "./stdlib/utils";

type Engine = "cse" | "pynter" | "pvml" | "py2js" | "wasm";

const ENGINES: Engine[] = ["cse", "pynter", "pvml", "py2js", "wasm"];

/** Mirrors PyWasmEvaluator1..4's own per-chapter groups (misc is added
 * internally by compileToWasmAndRun itself). */
const WASM_GROUPS: Record<number, Group[]> = {
  1: [],
  2: [linkedList],
  3: [linkedList, pairmutator, list],
  4: [linkedList, pairmutator, list, mce],
};

interface ReplOptions {
  variant: string;
  engine: Engine;
  pynter?: string;
}

async function runWasm(code: string, variant: number): Promise<string> {
  const groups = WASM_GROUPS[variant];
  if (!groups) {
    process.stderr.write(
      `--engine wasm currently supports chapters 1-4 only (got -v ${variant}).\n`,
    );
    process.exit(1);
  }
  const { errors, prints } = await compileToWasmAndRun(code, false, { chapter: variant, groups });
  if (errors.length > 0) {
    throw new Error(errors.map(e => e.message).join("\n"));
  }
  return prints.map(p => p + "\n").join("");
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

  if (opts.engine === "pynter" && !opts.pynter) {
    process.stderr.write(
      "--engine pynter requires --pynter <path>, pointing at a built native Pynter `runner`" +
        " binary (see https://github.com/source-academy/pynter#build-locally). To run PVML" +
        " bytecode without a native binary, use --engine pvml instead.\n",
    );
    process.exit(1);
  }

  if (opts.engine === "pynter" && variant !== 3) {
    process.stderr.write(
      `--engine pynter only supports SICPy §3 (got -v ${opts.variant}). Pass -v 3, use --engine pvml (supports §1-4), or drop --engine to use the CSE evaluator instead.\n`,
    );
    process.exit(1);
  }

  try {
    const output =
      opts.engine === "pynter"
        ? await runCodePvml(code, variant, { pynterPath: opts.pynter! })
        : opts.engine === "pvml"
          ? await runCodePvmlInterpreter(code, variant)
          : opts.engine === "py2js"
            ? runCodePy2Js(code, variant).output
            : opts.engine === "wasm"
              ? await runWasm(code, variant)
              : await runCode(code, variant);
    process.stdout.write(output);
  } catch (e) {
    process.stderr.write((e instanceof Error ? e.message : String(e)) + "\n");
    process.exit(1);
  }
}

const envEngine = process.env.PY_SLANG_ENGINE;

const program = new Command()
  .name("py-slang")
  .description("Run SICPy programs using the py-slang CSE, Pynter, PVML, py2js, or WASM evaluator")
  .argument("<file>", "SICPy source file to evaluate")
  .option("-v, --variant <number>", "SICPy chapter/variant (1–4)", "4")
  .option(
    "-e, --engine <name>",
    "Execution engine: cse, pynter, pvml, py2js, or wasm (default: $PY_SLANG_ENGINE, or cse)",
    envEngine ?? "cse",
  )
  .option(
    "--pynter <path>",
    "Path to a native Pynter `runner` binary (required for --engine pynter, which only supports -v 3)",
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
