/**
 * Standalone CLI for py-slang.
 *
 * Usage:
 *   yarn build:repl && yarn repl <file.py> [-v <1-4>]
 *   yarn repl <file.py> --engine svml --sinter <path-to-sinter-runner-binary> -v 3
 *
 * Runs a SICPy program either through the CSE evaluator (default) or by
 * compiling it to SVML bytecode and executing it on a native Sinter runner
 * (https://github.com/source-academy/sinter, built separately via CMake).
 * Writes output to stdout. Variant maps to SICPy chapter (1–4); defaults to 4.
 * --engine svml only supports §3 (-v 3); it exits with an error otherwise.
 */

import { readFileSync } from "fs";
import { Command } from "commander";
import { RunError, runCode } from "./runner";
import { runCodeSvml } from "./svml-runner";

type Engine = "cse" | "svml";

interface ReplOptions {
  variant: string;
  engine: Engine;
  sinter?: string;
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

  if (opts.engine === "svml" && !opts.sinter) {
    process.stderr.write(
      "--engine svml requires --sinter <path>, pointing at a built native Sinter `runner`" +
        " binary (see https://github.com/source-academy/sinter#build-locally).\n",
    );
    process.exit(1);
  }

  if (opts.engine === "svml" && variant !== 3) {
    process.stderr.write(
      `--engine svml only supports SICPy §3 (got -v ${opts.variant}). Pass -v 3, or drop --engine svml to use the CSE evaluator instead.\n`,
    );
    process.exit(1);
  }

  try {
    const output =
      opts.engine === "svml"
        ? await runCodeSvml(code, variant, { sinterPath: opts.sinter! })
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
  .description("Run SICPy programs using the py-slang CSE or SVML/Sinter evaluator")
  .argument("<file>", "SICPy source file to evaluate")
  .option("-v, --variant <number>", "SICPy chapter/variant (1–4)", "4")
  .option("-e, --engine <name>", "Execution engine: cse or svml", "cse")
  .option(
    "--sinter <path>",
    "Path to a native Sinter `runner` binary (required for --engine svml, which only supports -v 3)",
  )
  .action(async (file: string, opts: ReplOptions) => {
    if (opts.engine !== "cse" && opts.engine !== "svml") {
      process.stderr.write(`Invalid engine: ${opts.engine}. Expected cse or svml.\n`);
      process.exit(1);
    }
    await runFile(file, opts);
  });

program.parse();
