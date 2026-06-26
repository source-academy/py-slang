/**
 * Standalone CLI for py-slang.
 *
 * Usage:
 *   npx tsx src/repl.ts <file.py> [-v <1-4>]
 *   node dist/repl.cjs <file.py> [-v <1-4>]
 *
 * Runs a SICPy program through the CSE evaluator and prints output to stdout.
 * Variant maps to SICPy chapter (1-4); defaults to 4.
 */

import { readFileSync } from "fs";
import { Command } from "commander";
import { ErrorType } from "@sourceacademy/conductor/common";
import { Context } from "./engines/cse/context";
import { Control } from "./engines/cse/control";
import { Stash } from "./engines/cse/stash";
import { destroyStreams, displayError } from "./engines/cse/streams";
import { parse } from "./parser";
import { analyze } from "./resolver/analysis";
import { collectSnapshots } from "./conductor/plugins/PyCseMachinePlugin";
import misc from "./stdlib/misc";
import math from "./stdlib/math";
import linkedList from "./stdlib/linked-list";
import list from "./stdlib/list";
import pairmutator from "./stdlib/pairmutator";
import stream from "./stdlib/stream";
import parser from "./stdlib/parser";
import type { Group } from "./stdlib/utils";

const VARIANT_GROUPS: Record<number, Group[]> = {
  1: [misc, math],
  2: [misc, math, linkedList],
  3: [misc, math, linkedList, list, pairmutator, stream],
  4: [misc, math, linkedList, list, pairmutator, stream, parser],
};

function makeNodeStreams() {
  const stdoutStream = new WritableStream<string>({
    write(chunk) {
      process.stdout.write(chunk);
    },
  });
  const stderrStream = new WritableStream<any>({
    write(chunk) {
      const msg =
        typeof chunk === "string"
          ? chunk
          : (chunk?.message ?? String(chunk));
      process.stderr.write(msg + "\n");
    },
  });
  // For file-running mode, stdin is always EOF.
  const stdinStream = new ReadableStream<string>({
    start(controller) {
      controller.close();
    },
  });
  return {
    initialised: true as const,
    stdout: { stream: stdoutStream, writer: stdoutStream.getWriter() },
    stderr: { stream: stderrStream, writer: stderrStream.getWriter() },
    stdin: { stream: stdinStream, reader: stdinStream.getReader() },
  };
}

async function runFile(filename: string, variant: number): Promise<void> {
  const groups = VARIANT_GROUPS[variant];
  if (!groups) {
    process.stderr.write(`Invalid variant: ${variant}. Expected 1-4.\n`);
    process.exit(1);
  }

  let code: string;
  try {
    code = readFileSync(filename, "utf-8");
  } catch {
    process.stderr.write(`Cannot read file: ${filename}\n`);
    process.exit(1);
  }
  const script = code.endsWith("\n") ? code : code + "\n";

  const context = new Context();
  for (const group of groups) {
    for (const [name, value] of group.builtins) {
      context.nativeStorage.builtins.set(name, value);
    }
  }

  // Run prelude for each group that has one.
  const preludeText = groups.map((g) => g.prelude ?? "").join("\n");
  if (preludeText.trim()) {
    context.streams = makeNodeStreams();
    const preludeAst = parse(preludeText + "\n");
    await collectSnapshots(
      context,
      new Control(preludeAst),
      new Stash(),
      100000,
      -1,
      variant,
      preludeText + "\n",
      0,
    );
    await destroyStreams(context);
    if (context.errors.length > 0) {
      process.exit(1);
    }
  }

  try {
    context.streams = makeNodeStreams();

    const ast = parse(script);
    const errors = analyze(
      ast,
      script,
      variant,
      groups,
      Object.keys(context.runtime.environments[0].head),
    );
    if (errors.length > 0) {
      await Promise.all(
        errors.map((e) => displayError(context, e, ErrorType.EVALUATOR_SYNTAX)),
      );
      process.exit(1);
    }

    const control = new Control(ast);
    const stash = new Stash();
    context.control = control;
    context.stash = stash;

    // maxSnapshots=0: run to completion, collect no CSE snapshots (stdout only).
    await collectSnapshots(context, control, stash, 100000, -1, variant, script, 0);
  } catch (e) {
    const errors = Array.isArray(e) ? e : [e];
    await Promise.all(
      errors.map((err) => displayError(context, err, ErrorType.INTERNAL)),
    );
    process.exit(1);
  } finally {
    await destroyStreams(context);
  }
}

const program = new Command()
  .name("py-slang")
  .description("Run SICPy programs using the py-slang CSE evaluator")
  .argument("<file>", "SICPy source file to evaluate")
  .option("-v, --variant <number>", "SICPy chapter/variant (1–4)", "4")
  .action(async (file: string, opts: { variant: string }) => {
    const variant = parseInt(opts.variant, 10);
    await runFile(file, variant);
  });

program.parse();
