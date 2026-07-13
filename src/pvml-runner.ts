/**
 * Headless runners for the PVML pathway — two backends sharing the same
 * compiler (PVMLCompiler, also used by the PyPvmlEvaluator/
 * PyPvmlPynterEvaluator Conductor evaluators), differing only in what
 * actually executes the compiled bytecode:
 *
 *   - runCodePvml/runCodePvmlDetailed: assembles to a binary and executes it
 *     on a native Pynter `runner` binary (https://github.com/source-academy/pynter),
 *     built separately via CMake. Pynter is a fork of Sinter kept as a
 *     separate project so that Python-specific VM semantics don't risk
 *     destabilizing Sinter, which remains the fallback engine for the Source
 *     curriculum. Restricted to SICPy §3 (Pynter has no per-chapter runtime
 *     rules); no native binary required to build py-slang itself, but one
 *     must be supplied at call time.
 *
 *   - runCodePvmlInterpreter/runCodePvmlInterpreterDetailed: executes the
 *     compiled bytecode directly on PVMLInterpreter, the pure-TypeScript
 *     bytecode VM ("PVML-in-browser" — no WASM, no native binary, runs
 *     anywhere this package runs). Supports all four SICPy chapters, same as
 *     PyPvmlEvaluator1..4.
 *
 * Both mirror runCode()'s contract in runner.ts: the non-Detailed variant
 * returns concatenated print() output, throws RunError on any failure.
 */

import { ExprNS, StmtNS } from "./ast-types";
import { PYNTER_OPCODE_MAX } from "./engines/pvml/opcodes";
import { NativePynterError, runNativePynter } from "./engines/pvml/pynter/native-pynter";
import { assemble } from "./engines/pvml/pvml-assembler";
import { PVMLCompiler } from "./engines/pvml/pvml-compiler";
import { PVMLInterpreter } from "./engines/pvml/pvml-interpreter";
import type { PVMLBoxType } from "./engines/pvml/types";
import { parse } from "./parser";
import { analyzeWithEnvironments } from "./resolver";
import { RunError, VARIANT_GROUPS } from "./runner";
import type { Group } from "./stdlib/utils";
import { Token, TokenType } from "./tokenizer";

export interface RunPvmlOptions {
  /** Path to a built native Pynter `runner` binary. */
  pynterPath: string;
  /**
   * Stdlib groups to load, overriding the VARIANT_GROUPS[variant] default.
   * Needed for the handful of test suites that exercise a non-canonical
   * combination for a given variant (e.g. stream tests run at variant 2 with
   * the `stream`/`pairmutator` groups added on top).
   */
  groups?: Group[];
  /**
   * Rewrite the program's last top-level statement into `print(<that
   * expression>)` before compiling, if it's a bare expression not already a
   * print()/display() call. Native Pynter's execution model is exec-mode
   * only (see pvml-compiler.ts's visitFileInputStmt doc comment: the
   * compiled program never leaves a value on the stack, always ending in
   * RETU) — this is the only way to observe such a value, the same
   * technique runCodePvmlInterpreterDetailed's callers already use for the
   * browser pathway (see generatePvmlInBrowserTestCases in src/tests/utils.ts).
   * The captured line surfaces as `capturedResult` below, popped off of
   * `output` so it doesn't corrupt an `output`-only assertion.
   */
  captureLastExpression?: boolean;
}

export interface RunPvmlResult {
  /** Everything the program printed via print()/display(), concatenated — excludes the line captured by `captureLastExpression`, if any. */
  output: string;
  /**
   * The last top-level bare expression's value, as Python's str() would
   * render it — only set when `captureLastExpression` was requested. `"None"`
   * if the program's last statement was already its own print()/display()
   * call (that call's own, always-`None`, return value), `undefined` if the
   * last statement wasn't a bare expression at all (an assignment, `def`, ...).
   */
  capturedResult?: string;
  /** The type of the program's final value, as reported by Pynter (e.g. "integer", "string"). Always reflects RETU's `undefined` today — see visitFileInputStmt's doc comment — kept for fault diagnostics, not result comparison. */
  resultType: string;
  /** The program's final value, as reported by Pynter, still in its raw string form. See resultType's doc comment. */
  resultValue: string;
}

/**
 * Whether `expr` is a bare call to `print`/`display` (both the same
 * primitive — see builtins.ts's PRIMITIVE_FUNCTIONS, index 5). Guards
 * wrapLastExpressionInPrint below against double-wrapping a program whose
 * last statement is already its own print()/display() call.
 */
export function isBarePrintCall(expr: ExprNS.Expr): boolean {
  return (
    expr instanceof ExprNS.Call &&
    expr.callee instanceof ExprNS.Variable &&
    (expr.callee.name.lexeme === "print" || expr.callee.name.lexeme === "display")
  );
}

/**
 * Rewrites `ast`'s last top-level statement, in place, from a bare
 * expression into `print(<that expression>)` — in the already-parsed AST,
 * not by re-serializing/re-parsing source text, so an expression with its
 * own side effects is evaluated exactly once. Returns whether a rewrite
 * happened (false if the last statement isn't a bare expression at all,
 * e.g. an assignment or `def`, in which case there's nothing to capture).
 * Requires `print` to be resolvable in whatever stdlib groups the caller
 * compiles against (the `misc` group, in scope for every VARIANT_GROUPS
 * default).
 */
export function wrapLastExpressionInPrint(ast: StmtNS.FileInput): boolean {
  const last = ast.statements[ast.statements.length - 1];
  if (!(last instanceof StmtNS.SimpleExpr)) return false;
  const token = new Token(TokenType.NAME, "print", last.startToken.line, 0, -1);
  token.synthetic = true;
  const printCallee = new ExprNS.Variable(token, token, token);
  const call = new ExprNS.Call(last.startToken, last.endToken, printCallee, [last.expression]);
  ast.statements[ast.statements.length - 1] = new StmtNS.SimpleExpr(
    last.startToken,
    last.endToken,
    call,
  );
  return true;
}

/**
 * Evaluate `code` as a SICPy program at the given `variant` by compiling it
 * to PVML and running it on a native Pynter binary. Returns both the
 * program's print() output and its final result value/type.
 *
 * Stdlib groups default to VARIANT_GROUPS[variant] (see runner.ts), matching
 * the CSE pathway's chapter coverage. A group's prelude (SICPy source, e.g.
 * linked-list.prelude.ts's `equal`/`map`/`reverse`/...) is prepended to
 * `code` and compiled + run as a single PVML program: unlike the CSE
 * machine, which runs the prelude once into a shared, mutable environment
 * ahead of the main script, each native Pynter invocation is a fresh
 * process with no persistent environment to carry prelude bindings across —
 * so prelude and script must be one compilation unit for the script to see
 * the prelude's functions at all.
 */
export async function runCodePvmlDetailed(
  code: string,
  variant: number,
  options: RunPvmlOptions,
): Promise<RunPvmlResult> {
  // Pynter's target is Python (SICPy) §3 specifically (see pynter/README.md) —
  // it implements that chapter's semantics unconditionally, with no runtime
  // notion of "chapter" to gate narrower/wider rules for §1/§2/§4. Reject
  // anything else here rather than silently running it with the wrong rules.
  if (variant !== 3) {
    throw new RunError("parse", `Pynter only supports Python §3; got variant ${variant}.`);
  }

  const { pynterPath, groups = VARIANT_GROUPS[variant] } = options;
  if (!groups) throw new RunError("parse", `Invalid variant: ${variant}. Expected 1–4.`);

  const script = code.endsWith("\n") ? code : code + "\n";
  const preludeText = groups
    .map(g => g.prelude ?? "")
    .filter(p => p.trim())
    .join("\n");
  const fullSource = preludeText ? `${preludeText}\n${script}` : script;

  let ast;
  try {
    ast = parse(fullSource);
  } catch (e: unknown) {
    throw new RunError("parse", String((e as { message?: string })?.message ?? e));
  }

  let alreadyPrintsLastExpr = false;
  let wrappedLastExpr = false;
  if (options.captureLastExpression) {
    const last = ast.statements[ast.statements.length - 1];
    alreadyPrintsLastExpr = last instanceof StmtNS.SimpleExpr && isBarePrintCall(last.expression);
    wrappedLastExpr = !alreadyPrintsLastExpr && wrapLastExpressionInPrint(ast);
  }

  const { errors, environments } = analyzeWithEnvironments(ast, fullSource, variant, groups);
  if (errors.length > 0) {
    throw new RunError("analysis", errors.map(e => e.message).join("\n"));
  }

  let binary: Uint8Array;
  try {
    const compiler = PVMLCompiler.fromProgram(ast, variant, environments, false, true);
    const program = compiler.compileProgram(ast);
    binary = assemble(program, PYNTER_OPCODE_MAX);
  } catch (e: unknown) {
    throw new RunError("runtime", String((e as { message?: string })?.message ?? e));
  }

  let result;
  try {
    result = await runNativePynter(binary, pynterPath);
  } catch (e: unknown) {
    if (e instanceof NativePynterError) {
      throw new RunError("runtime", e.message);
    }
    throw e;
  }

  if (result.fault !== "no fault") {
    throw new RunError(
      "runtime",
      `Pynter fault: ${result.fault} (result type: ${result.resultType}, value: ${result.resultValue})`,
    );
  }

  let output = result.output;
  let capturedResult: string | undefined;
  if (wrappedLastExpr) {
    // Every print()/display() call appends exactly one "\n" (see
    // native-pynter.ts's output-parsing doc comment) — the wrapped call's
    // own line is always the last one, popped off so it doesn't corrupt an
    // `output`-only assertion (see generatePvmlInBrowserTestCases' identical
    // technique for the browser pathway).
    const trimmed = output.endsWith("\n") ? output.slice(0, -1) : output;
    const lastNewline = trimmed.lastIndexOf("\n");
    capturedResult = lastNewline === -1 ? trimmed : trimmed.slice(lastNewline + 1);
    output = lastNewline === -1 ? "" : trimmed.slice(0, lastNewline + 1);
  } else if (alreadyPrintsLastExpr) {
    capturedResult = "None";
  }

  return { output, capturedResult, resultType: result.resultType, resultValue: result.resultValue };
}

/**
 * Evaluate `code` as a SICPy program at the given `variant`, returning only
 * its print() output. See runCodePvmlDetailed() for the full result.
 */
export async function runCodePvml(
  code: string,
  variant: number,
  options: RunPvmlOptions,
): Promise<string> {
  const { output } = await runCodePvmlDetailed(code, variant, options);
  return output;
}

export interface RunPvmlInterpreterOptions {
  /**
   * Stdlib groups to load, overriding the VARIANT_GROUPS[variant] default.
   * See RunPvmlOptions.groups.
   */
  groups?: Group[];
}

export interface RunPvmlInterpreterResult {
  /** Everything the program printed via print()/display(), concatenated. */
  output: string;
}

/**
 * Evaluate `code` as a SICPy program at the given `variant` (1–4) by
 * compiling it to PVML and running it directly on PVMLInterpreter — the
 * pure-TypeScript "PVML-in-browser" VM, no native binary involved. Unlike
 * runCodePvmlDetailed (native Pynter, §3 only), this supports all four
 * SICPy chapters, matching PyPvmlEvaluator1..4.
 *
 * A group's prelude (SICPy source, e.g. linked-list.prelude.ts's
 * `equal`/`map`/`reverse`/...) is compiled and run once into the
 * interpreter's globalEnv ahead of `code` itself — mirroring
 * PyPvmlEvaluatorBase's own persistent-globalEnv model (see
 * conductor/PyPvmlEvaluator.ts) — rather than concatenated into one
 * compilation unit the way runCodePvmlDetailed has to for native Pynter
 * (which has no persistent environment across separate compiles).
 */
export function runCodePvmlInterpreterDetailed(
  code: string,
  variant: number,
  options: RunPvmlInterpreterOptions = {},
): Promise<RunPvmlInterpreterResult> {
  // PVMLInterpreter is fully synchronous (see pvml-interpreter.ts), so there's
  // no real async work here — but the function still needs to *return* a
  // Promise (matching runCodePvmlDetailed's contract, and every RunError
  // thrown below needs to surface as a rejection, not a synchronous throw at
  // the call site, for callers like `await expect(...).rejects.toThrow()` to
  // work). Wrapping the whole synchronous body in `.then()` gets both for
  // free without an `async` keyword that has nothing to `await`.
  return Promise.resolve().then(() => runCodePvmlInterpreterSync(code, variant, options));
}

function runCodePvmlInterpreterSync(
  code: string,
  variant: number,
  options: RunPvmlInterpreterOptions,
): RunPvmlInterpreterResult {
  const { groups = VARIANT_GROUPS[variant] } = options;
  if (!groups) throw new RunError("parse", `Invalid variant: ${variant}. Expected 1–4.`);

  // PVMLInterpreter's print/display primitive deliberately does *not*
  // append a trailing newline itself (each call is one newline-free
  // sendOutput chunk — see pvml-interpreter.test.ts's "multiple print calls"
  // expecting `["a", "b"]`, not `["a\n", "b\n"]`), unlike the CSE machine's
  // own print() (misc.ts), which appends "\n" before ever reaching its
  // output stream. Add it back here so concatenated output reads the same
  // (one line per print() call) as runCode()'s CSE-backed output.
  const outputs: string[] = [];
  const sendOutput = (msg: string) => outputs.push(msg + "\n");

  const runChunk = (script: string, globalEnv: Map<string, PVMLBoxType>) => {
    const source = script.endsWith("\n") ? script : script + "\n";
    let ast;
    try {
      ast = parse(source);
    } catch (e: unknown) {
      throw new RunError("parse", String((e as { message?: string })?.message ?? e));
    }

    const { errors, environments } = analyzeWithEnvironments(
      ast,
      source,
      variant,
      groups,
      [],
      Array.from(globalEnv.keys()),
    );
    if (errors.length > 0) {
      throw new RunError("analysis", errors.map(e => e.message).join("\n"));
    }

    let interpreter: PVMLInterpreter;
    try {
      const compiler = PVMLCompiler.fromProgram(ast, variant, environments, true);
      const program = compiler.compileProgram(ast);
      interpreter = new PVMLInterpreter(program, { sendOutput, globalEnv, programText: script });
      // A Python script has no return value of its own (see pvml-compiler.ts's
      // visitFileInputStmt doc comment) — execute()'s return is always undefined
      // now, so there's nothing worth keeping from it here.
      interpreter.execute();
      return { globalEnv: interpreter.getGlobalEnv() };
    } catch (e: unknown) {
      throw new RunError("runtime", String((e as { message?: string })?.message ?? e));
    }
  };

  let globalEnv = new Map<string, PVMLBoxType>();
  const preludeText = groups
    .map(g => g.prelude ?? "")
    .filter(p => p.trim())
    .join("\n");
  if (preludeText.trim()) {
    globalEnv = runChunk(preludeText, globalEnv).globalEnv;
  }

  runChunk(code, globalEnv);

  return { output: outputs.join("") };
}

/**
 * Evaluate `code` as a SICPy program at the given `variant`, returning only
 * its print() output. See runCodePvmlInterpreterDetailed() for the full result.
 */
export async function runCodePvmlInterpreter(
  code: string,
  variant: number,
  options: RunPvmlInterpreterOptions = {},
): Promise<string> {
  const { output } = await runCodePvmlInterpreterDetailed(code, variant, options);
  return output;
}
