/**
 * Core headless runner for py-slang.
 *
 * Evaluates a SICPy program through the CSE machine, captures all output
 * written by print() calls, and returns it as a string.  Errors (parse,
 * analysis, runtime) are thrown as RunError so callers can distinguish them
 * from evaluation output.
 */

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

export const VARIANT_GROUPS: Record<number, Group[]> = {
  1: [misc, math],
  2: [misc, math, linkedList],
  3: [misc, math, linkedList, list, pairmutator, stream],
  4: [misc, math, linkedList, list, pairmutator, stream, parser],
};

export class RunError extends Error {
  constructor(
    public readonly kind: "parse" | "analysis" | "runtime",
    message: string,
  ) {
    super(message);
    this.name = "RunError";
  }
}

/**
 * Build a set of in-memory streams.
 *
 * `onOutput` is called for every string the program writes (each print() call).
 * `onError`  is called for every error the evaluator surfaces.
 */
function makeMemoryStreams(onOutput: (s: string) => void, onError: (s: string) => void) {
  const stdoutStream = new WritableStream<string>({ write: onOutput });
  const stderrStream = new WritableStream<any>({
    write(chunk) {
      onError(typeof chunk === "string" ? chunk : (chunk?.message ?? String(chunk)));
    },
  });
  const stdinStream = new ReadableStream<string>({
    start(controller) { controller.close(); },
  });
  return {
    initialised: true as const,
    stdout: { stream: stdoutStream, writer: stdoutStream.getWriter() },
    stderr: { stream: stderrStream, writer: stderrStream.getWriter() },
    stdin:  { stream: stdinStream,  reader: stdinStream.getReader() },
  };
}

/**
 * Evaluate `code` as a SICPy program at the given `variant` (1–4).
 *
 * Returns all output produced by print() calls, concatenated.
 * Throws `RunError` on any parse, analysis, or runtime error.
 */
export async function runCode(code: string, variant: number): Promise<string> {
  const groups = VARIANT_GROUPS[variant];
  if (!groups) throw new RunError("parse", `Invalid variant: ${variant}. Expected 1–4.`);

  const script = code.endsWith("\n") ? code : code + "\n";

  const context = new Context();
  for (const group of groups) {
    for (const [name, value] of group.builtins) {
      context.nativeStorage.builtins.set(name, value);
    }
  }

  // Load group preludes (e.g. list, stream definitions written in SICPy itself).
  const preludeText = groups.map((g) => g.prelude ?? "").join("\n");
  if (preludeText.trim()) {
    const preludeErrors: string[] = [];
    context.streams = makeMemoryStreams(() => {}, (e) => preludeErrors.push(e));
    const preludeAst = parse(preludeText + "\n");
    await collectSnapshots(
      context, new Control(preludeAst), new Stash(),
      100000, -1, variant, preludeText + "\n", 0,
    );
    await destroyStreams(context);
    if (context.errors.length > 0 || preludeErrors.length > 0) {
      throw new RunError("runtime", preludeErrors.join("\n") || "Prelude failed");
    }
  }

  const output: string[] = [];
  const errors: string[] = [];

  try {
    context.streams = makeMemoryStreams(
      (s) => output.push(s),
      (e) => errors.push(e),
    );

    let ast;
    try {
      ast = parse(script);
    } catch (e: any) {
      throw new RunError("parse", String(e?.message ?? e));
    }

    const analysisErrors = analyze(
      ast, script, variant, groups,
      Object.keys(context.runtime.environments[0].head),
    );
    if (analysisErrors.length > 0) {
      // Surface them through the error stream so the message is formatted the
      // same way as runtime errors, then throw.
      await Promise.all(
        analysisErrors.map((e) => displayError(context, e, ErrorType.EVALUATOR_SYNTAX)),
      );
      throw new RunError("analysis", errors.join("\n"));
    }

    const control = new Control(ast);
    const stash = new Stash();
    context.control = control;
    context.stash = stash;

    await collectSnapshots(context, control, stash, 100000, -1, variant, script, 0);

    if (context.errors.length > 0 || errors.length > 0) {
      throw new RunError("runtime", errors.join("\n"));
    }
  } finally {
    await destroyStreams(context);
  }

  return output.join("");
}
