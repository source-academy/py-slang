/**
 * py2js engine — entry point.
 *
 * Pipeline: parse (the shared py-slang parser) -> resolve with the chapter's
 * validators (same Resolver the other engines use) -> compile to a JS source
 * string (compiler.ts) -> instantiate via new Function / AsyncFunction ->
 * run against a fresh Py2JsRuntime, collecting print() output.
 *
 * Exec-style only, like the PVML-in-browser pathway: a program has no "final
 * value" — everything observable goes through print(). Currently chapters
 * 1-2 (identical operator typing rules at both — docs/specs/
 * python_typing_front.tex, python_typing_middle_12.tex,
 * python_typing_back.tex), pinned against the CSE machine by
 * src/tests/operator-conformance-py2js.test.ts.
 */
import { parse } from "../../parser";
import { Resolver } from "../../resolver";
import linkedList from "../../stdlib/linked-list";
import math from "../../stdlib/math";
import misc from "../../stdlib/misc";
import type { Group } from "../../stdlib/utils";
import { makeValidatorsForChapter } from "../../validator";
import { CompileMode, compileProgram, Py2JsCompileError } from "./compiler";
import { annotateHostFunction, Py2JsRuntime, Py2JsRuntimeError, PyValue } from "./runtime";
import { bridgeStdlibGroups } from "./stdlibBridge";

const SUPPORTED_CHAPTERS = [1, 2];

/**
 * Stdlib groups per chapter, bridged into the runtime by prepare(). Mirrors
 * runner.ts's VARIANT_GROUPS (kept separate so the engine does not pull in
 * the runner's conductor plumbing); extend as chapters 3+ land.
 */
const PY2JS_GROUPS: Record<number, Group[]> = {
  1: [misc, math],
  2: [misc, math, linkedList],
};

export { Py2JsCompileError, Py2JsRuntime, Py2JsRuntimeError };
export type { CompileMode, PyValue };

/** Mirrors runner.ts's RunError contract so callers can distinguish phases. */
export class Py2JsRunError extends Error {
  constructor(
    public readonly kind: "parse" | "analysis" | "runtime",
    message: string,
  ) {
    super(message);
    this.name = "Py2JsRunError";
  }
}

export interface RunPy2JsOptions {
  /**
   * Extra builtin bindings (typically conductor-module functions), merged
   * over the runtime's native set before compilation; pass a factory when
   * the bindings need the runtime itself (to call back into Python via
   * callSync / acall).
   */
  extraBuiltins?: Record<string, PyValue> | ((rt: Py2JsRuntime) => Record<string, PyValue>);
}

export interface RunPy2JsResult {
  /** Everything the program printed via print(), concatenated. */
  output: string;
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
  ...args: string[]
) => (rt: Py2JsRuntime) => Promise<void>;

/**
 * Compiles `script` against `rt`'s current builtins/globals and returns the
 * generated JS — REPL mode always, with `priorGlobals` as whatever
 * module-level names already exist (empty for the prelude itself; the
 * prelude's own names for the main script). REPL mode's globals *table* is
 * what lets a prelude define names a separately-compiled later script can
 * see; program mode's per-call `let` locals cannot span two compilations
 * (see compiler.ts's mode doc) — the reason `prepare()` uses REPL mode
 * unconditionally rather than only when a chapter actually has a prelude.
 */
function compileScript(
  rt: Py2JsRuntime,
  script: string,
  variant: number,
  mode: CompileMode,
): string {
  let ast;
  try {
    ast = parse(script);
  } catch (e: unknown) {
    throw new Py2JsRunError("parse", String((e as { message?: string })?.message ?? e));
  }

  const priorGlobals = Object.keys(rt.globals);
  // Same static pipeline as the other engines: the Resolver checks names and
  // enforces the chapter's feature validators. The runtime's builtin names
  // are passed as prelude names (its own term for names resolvable without a
  // binding statement) so they resolve without a stdlib group; priorGlobals
  // are real module-level bindings an earlier compilation (the prelude) made.
  const resolver = new Resolver(
    script,
    ast,
    makeValidatorsForChapter(variant),
    [],
    Object.keys(rt.builtins),
    priorGlobals,
  );
  const errors = resolver.resolve(ast);
  if (errors.length > 0) {
    throw new Py2JsRunError("analysis", errors.map(e => e.message).join("\n"));
  }

  try {
    return compileProgram(ast, Object.keys(rt.builtins), { mode, repl: { priorGlobals } });
  } catch (e: unknown) {
    if (e instanceof Py2JsCompileError) throw new Py2JsRunError("analysis", e.message);
    throw e;
  }
}

function prepare(
  code: string,
  variant: number,
  mode: CompileMode,
  options: RunPy2JsOptions,
): { rt: Py2JsRuntime; js: string } {
  if (!SUPPORTED_CHAPTERS.includes(variant)) {
    throw new Py2JsRunError(
      "parse",
      `py2js currently supports chapters ${SUPPORTED_CHAPTERS.join("-")} only (got ${variant})`,
    );
  }

  const rt = new Py2JsRuntime();
  const script = code.endsWith("\n") ? code : code + "\n";
  const groups = PY2JS_GROUPS[variant] ?? [];

  // The chapter's stdlib groups, bridged to native values (stdlibBridge.ts).
  // The runtime's native core (print/input/arity) wins over same-named
  // bridged entries; extraBuiltins (module bindings etc.) override anything.
  const bridged = bridgeStdlibGroups(rt, groups, script, variant);
  for (const [name, value] of Object.entries(bridged)) {
    if (!(name in rt.builtins)) rt.builtins[name] = value;
  }
  const extra = options.extraBuiltins;
  const extraResolved = typeof extra === "function" ? extra(rt) : (extra ?? {});
  for (const [name, value] of Object.entries(extraResolved)) {
    // Plain JS functions from outside get the PyFunction metadata invariant
    // established here (name, arity reporting, built-in rendering) — see
    // annotateHostFunction; already-annotated functions pass through as-is.
    rt.builtins[name] = annotateHostFunction(name, value);
  }

  // Group preludes (SICPy source defining higher-level functions in terms of
  // the group's own primitives — e.g. linked-list.prelude.ts's map/filter/
  // reduce) run once, always in sync mode: nothing at chapter 1-2 imports
  // anything, so there is no reason for the prelude itself to need the async
  // spine even when the main script below is compiled in dual mode.
  const preludeText = groups
    .map(g => g.prelude ?? "")
    .filter(p => p.trim())
    .join("\n");
  if (preludeText.trim()) {
    const preludeJs = compileScript(rt, preludeText + "\n", variant, "sync");
    try {
      new Function("__py", preludeJs)(rt);
    } catch (e: unknown) {
      throw new Py2JsRunError(
        "runtime",
        e instanceof Error ? `${e.name}: ${e.message}` : String(e),
      );
    }
  }

  const js = compileScript(rt, script, variant, mode);
  return { rt, js };
}

/**
 * Evaluate `code` as a SICPy program at the given `variant` in sync mode,
 * returning its print() output. Throws Py2JsRunError on any failure.
 */
export function runCodePy2Js(
  code: string,
  variant: number,
  options: RunPy2JsOptions = {},
): RunPy2JsResult {
  const { rt, js } = prepare(code, variant, "sync", options);
  try {
    new Function("__py", js)(rt);
  } catch (e: unknown) {
    throw new Py2JsRunError(
      "runtime",
      // Keep the Python error kind (Py2JsRuntimeError sets name = pyKind), so
      // callers can still tell ZeroDivisionError from TypeError etc.
      e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    );
  }
  return { output: rt.output.join("") };
}

/**
 * Evaluate `code` in dual mode: the program's spine is async (module calls
 * can await frontend round-trips) while every user function also carries a
 * sync body that TS modules can call back at full speed (rt.callSync).
 */
export async function runCodePy2JsDual(
  code: string,
  variant: number,
  options: RunPy2JsOptions = {},
): Promise<RunPy2JsResult> {
  const { rt, js } = prepare(code, variant, "dual", options);
  try {
    await new AsyncFunction("__py", js)(rt);
  } catch (e: unknown) {
    throw new Py2JsRunError(
      "runtime",
      // Keep the Python error kind (Py2JsRuntimeError sets name = pyKind), so
      // callers can still tell ZeroDivisionError from TypeError etc.
      e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    );
  }
  return { output: rt.output.join("") };
}

/** Compile only (for inspection/debugging of generated code). */
export function compilePy2Js(code: string, variant = 1, mode: CompileMode = "sync"): string {
  const { js } = prepare(code, variant, mode, {});
  return js;
}

export interface Py2JsSessionOptions extends RunPy2JsOptions {
  /** Streams each print() line (no trailing newline) as it happens — the
   * conductor evaluator forwards these to the frontend. */
  onOutput?: (line: string) => void;
}

/**
 * A persistent py2js session: chunks share one runtime and one module-level
 * globals table (REPL compile mode, see compiler.ts), so a later chunk sees
 * every name an earlier chunk (or a group prelude) bound — and functions from
 * earlier chunks see later *redefinitions*, via gref's late lookup, matching
 * the CSE machine's global-environment semantics. This is what the conductor
 * evaluator (src/conductor/Py2JsEvaluator.ts) drives, one runChunk() per
 * evaluateChunk().
 *
 * Unlike runCodePy2Js (which wraps everything in Py2JsRunError), runChunk
 * throws the underlying errors raw — parse errors, the first resolver error,
 * or the runtime's Py2JsRuntimeError — so callers like the conductor
 * evaluator keep the error's name and any source location it carries.
 */
export class Py2JsSession {
  readonly rt: Py2JsRuntime;
  private readonly variant: number;
  private readonly groups: Group[];
  private preludeLoaded = false;

  constructor(variant: number, options: Py2JsSessionOptions = {}) {
    if (!SUPPORTED_CHAPTERS.includes(variant)) {
      throw new Py2JsRunError(
        "parse",
        `py2js currently supports chapters ${SUPPORTED_CHAPTERS.join("-")} only (got ${variant})`,
      );
    }
    this.variant = variant;
    this.groups = PY2JS_GROUPS[variant] ?? [];
    this.rt = new Py2JsRuntime();
    this.rt.onOutput = options.onOutput;

    // Same builtin layering as prepare(): bridged stdlib under the native
    // core, extraBuiltins over everything. The bridge's source string is
    // empty — its synthetic error nodes never point at real chunk text.
    const bridged = bridgeStdlibGroups(this.rt, this.groups, "", variant);
    for (const [name, value] of Object.entries(bridged)) {
      if (!(name in this.rt.builtins)) this.rt.builtins[name] = value;
    }
    const extra = options.extraBuiltins;
    const extraResolved = typeof extra === "function" ? extra(this.rt) : (extra ?? {});
    for (const [name, value] of Object.entries(extraResolved)) {
      this.rt.builtins[name] = annotateHostFunction(name, value);
    }
  }

  /** Compile and run one chunk against the persistent globals (sync mode). */
  runChunk(code: string): void {
    if (!this.preludeLoaded) {
      this.preludeLoaded = true;
      const preludeText = this.groups
        .map(g => g.prelude ?? "")
        .filter(p => p.trim())
        .join("\n");
      if (preludeText.trim()) this.runChunkInternal(preludeText);
    }
    this.runChunkInternal(code);
  }

  private runChunkInternal(code: string): void {
    const script = code.endsWith("\n") ? code : code + "\n";
    const ast = parse(script);

    // Prior chunks' global names are passed as the resolver's module-level
    // names (its REPL parameter), exactly how the PVML evaluator seeds
    // analyzeWithEnvironments from its persistent globalEnv.
    const priorGlobals = Object.keys(this.rt.globals);
    const resolver = new Resolver(
      script,
      ast,
      makeValidatorsForChapter(this.variant),
      [],
      Object.keys(this.rt.builtins),
      priorGlobals,
    );
    const errors = resolver.resolve(ast);
    if (errors.length > 0) throw errors[0];

    const js = compileProgram(ast, Object.keys(this.rt.builtins), {
      mode: "sync",
      repl: { priorGlobals },
    });
    new Function("__py", js)(this.rt);
  }
}
