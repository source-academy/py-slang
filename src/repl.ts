/**
 * Standalone CLI for py-slang.
 *
 * Usage:
 *   yarn build:repl && yarn repl <file.py> [-v <1-4>]
 *
 * Runs a SICPy program through the CSE evaluator and writes output to stdout.
 * Variant maps to SICPy chapter (1–4); defaults to 4.
 */

import { readFileSync } from "fs";
import { Command } from "commander";
import { runCode, RunError } from "./runner";

async function runFile(filename: string, variant: number): Promise<void> {
  let code: string;
  try {
    code = readFileSync(filename, "utf-8");
  } catch {
    process.stderr.write(`Cannot read file: ${filename}\n`);
    process.exit(1);
  }

  try {
    const output = await runCode(code, variant);
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
  .description("Run SICPy programs using the py-slang CSE evaluator")
  .argument("<file>", "SICPy source file to evaluate")
  .option("-v, --variant <number>", "SICPy chapter/variant (1–4)", "4")
  .action(async (file: string, opts: { variant: string }) => {
    await runFile(file, parseInt(opts.variant, 10));
  });

program.parse();
