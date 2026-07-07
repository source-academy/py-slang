/**
 * Standalone CLI for py-slang.
 *
 * Usage:
 *   yarn build:repl && yarn repl <file.py> [-v <1-4>]
 *   yarn repl <file.py> --engine pvml --pynter <path-to-pynter-runner-binary> -v 3
 *
 * Runs a SICPy program either through the CSE evaluator (default) or by
 * compiling it to PVML bytecode and executing it on a native Pynter runner
 * (https://github.com/source-academy/pynter, built separately via CMake).
 * Pynter is a fork of Sinter (https://github.com/source-academy/sinter)
 * kept as a separate project so that Python-specific VM semantics don't risk
 * destabilizing Sinter, which remains the fallback engine for the Source
 * curriculum.
 * Writes output to stdout. Variant maps to SICPy chapter (1–4); defaults to 4.
 * --engine pvml only supports §3 (-v 3); it exits with an error otherwise.
 */

import { readFileSync } from "fs";
import { Command } from "commander";
import { runCodePvml } from "./pvml-runner";
import { RunError, runCode } from "./runner";

type Engine = "cse" | "pvml";

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
        " binary (see https://github.com/source-academy/pynter#build-locally).\n",
    );
    process.exit(1);
  }

  if (opts.engine === "pvml" && variant !== 3) {
    process.stderr.write(
      `--engine pvml only supports SICPy §3 (got -v ${opts.variant}). Pass -v 3, or drop --engine pvml to use the CSE evaluator instead.\n`,
    );
    process.exit(1);
  }

  try {
    const output =
      opts.engine === "pvml"
        ? await runCodePvml(code, variant, { pynterPath: opts.pynter! })
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

const program = new Command()
  .name("py-slang")
  .description("Run SICPy programs using the py-slang CSE or PVML/Pynter evaluator")
  .argument("<file>", "SICPy source file to evaluate")
  .option("-v, --variant <number>", "SICPy chapter/variant (1–4)", "4")
  .option("-e, --engine <name>", "Execution engine: cse or pvml", "cse")
  .option(
    "--pynter <path>",
    "Path to a native Pynter `runner` binary (required for --engine pvml, which only supports -v 3)",
  )
  .action(async (file: string, opts: ReplOptions) => {
    if (opts.engine !== "cse" && opts.engine !== "pvml") {
      process.stderr.write(`Invalid engine: ${opts.engine}. Expected cse or pvml.\n`);
      process.exit(1);
    }
    await runFile(file, opts);
  });

program.parse();
