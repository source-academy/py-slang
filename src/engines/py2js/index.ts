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
import { IDataHandler } from "@sourceacademy/conductor/types";
import type { BaseDataVisualizerRunnerPlugin } from "@sourceacademy/runner-data-visualizer";
import { GenericDataHandler } from "../../conductor/GenericDataHandler";
import { parse } from "../../parser";
import { Resolver } from "../../resolver";
import linkedList from "../../stdlib/linked-list";
import list from "../../stdlib/list";
import math from "../../stdlib/math";
import misc from "../../stdlib/misc";
import pairmutator from "../../stdlib/pairmutator";
import parser from "../../stdlib/parser";
import stream from "../../stdlib/stream";
import type { Group } from "../../stdlib/utils";
import { makeValidatorsForChapter } from "../../validator";
import { StmtNS } from "../../ast-types";
import { bundleLocalImports } from "../../modules/localImports";
import { CompileMode, compileProgram, Py2JsCompileError } from "./compiler";
import { hasImports, loadChunkImports } from "./moduleInterop";
import { annotateHostFunction, Py2JsRuntime, Py2JsRuntimeError, PyValue } from "./runtime";
import { bridgeStdlibGroups } from "./stdlibBridge";

const SUPPORTED_CHAPTERS = [1, 2, 3, 4];

/**
 * Stdlib groups per chapter, bridged into the runtime by prepare(). Mirrors
 * runner.ts's VARIANT_GROUPS (kept separate so the engine does not pull in
 * the runner's conductor plumbing).
 */
const PY2JS_GROUPS: Record<number, Group[]> = {
  1: [misc, math],
  2: [misc, math, linkedList],
  3: [misc, math, linkedList, list, pairmutator, stream],
  4: [misc, math, linkedList, list, pairmutator, stream, parser],
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
  /**
   * Sibling files `code` (the entrypoint) can locally import from
   * (`from .foo import x`), keyed by absolute path (e.g. `"/utils.py"`) —
   * see src/modules/localImports.ts. Only honored by
   * runCodePy2JsDual/Py2JsSession: a local import may need to compile and
   * run another file first, which is inherently async, so runCodePy2Js's
   * synchronous contract cannot support it (the same pre-existing
   * limitation it already has for conductor-module imports). Ignored when
   * `fileGetter` is supplied.
   */
  files?: Record<string, string>;
  /**
   * Resolves a sibling file on demand instead of requiring the whole
   * program up front — e.g. the conductor evaluator passes
   * `path => conductor.requestFile(path)`, backed by whatever multi-file
   * store the host (the frontend's folder-mode BrowserFS) already has.
   * Takes priority over `files` when both are given.
   */
  fileGetter?: (path: string) => Promise<string | undefined>;
  /** The entrypoint's own key into `files` (and, for Py2JsSession, into
   * every chunk it runs against the same persistent environment) — what a
   * sibling file's relative import is resolved against. Defaults to
   * `"/main.py"`. */
  entrypointFilePath?: string;
}

export interface RunPy2JsResult {
  /** Everything the program printed via print(), concatenated. */
  output: string;
}

/** `fileGetter` wins when both are given (see RunPy2JsOptions doc); a plain
 * `files` map is just wrapped into the same async shape
 * src/modules/localImports.ts expects — always defined, even with neither
 * option set (a program with no local imports never calls it). */
function toFileGetter(
  options: Pick<RunPy2JsOptions, "files" | "fileGetter">,
): (path: string) => Promise<string | undefined> {
  if (options.fileGetter) return options.fileGetter;
  const files = options.files ?? {};
  return path => Promise.resolve(files[path]);
}

/** True iff `statements` contains a local (level > 0) import — the signal
 * to bundle before doing anything else (see bundleLocalImports). A program
 * with only level === 0 (conductor-module) imports, or none at all, is
 * completely unaffected — bundleLocalImports itself would also no-op for
 * these, but checking here avoids even parsing/walking for it. */
function hasLocalImports(statements: StmtNS.Stmt[]): boolean {
  return statements.some(s => s.kind === "FromImport" && (s as StmtNS.FromImport).level > 0);
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

/**
 * Builds a fresh runtime for `code` at `variant`: bridges the chapter's
 * stdlib groups and extraBuiltins, then runs the chapter's group preludes
 * (always sync — see the inline comment below). Shared by both `prepare()`
 * (sync path) and `prepareDual()` (async path, so local-file imports in the
 * main script itself can be resolved with an `await` in between this setup
 * and compiling that script — see prepareDual's own doc comment).
 */
function setupRuntime(
  code: string,
  variant: number,
  options: RunPy2JsOptions,
): { rt: Py2JsRuntime; script: string } {
  if (!SUPPORTED_CHAPTERS.includes(variant)) {
    throw new Py2JsRunError(
      "parse",
      `py2js currently supports chapters ${SUPPORTED_CHAPTERS.join("-")} only (got ${variant})`,
    );
  }

  const rt = new Py2JsRuntime(variant >= 3);
  const script = code.endsWith("\n") ? code : code + "\n";
  const groups = PY2JS_GROUPS[variant] ?? [];

  // Predeclared at every chapter, not just 4 — the CSE machine defines it
  // unconditionally (interpreter.ts's pyDefineVariable("__program__", ...)),
  // matching the spec's "the Source Academy frontend predeclares the name
  // __program__ in all Python languages" (docs/specs/python_interpreter.tex).
  // It's documented under chapter 4 only because that's where tokenize/parse
  // are introduced, not because availability itself is chapter-gated.
  rt.builtins.__program__ = code;

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
    // Marks every function this defines pyPrelude: true (see Py2JsRuntime.def) — lets a
    // bridged builtin's error name the predefined function it happened inside of
    // (py-slang#397), e.g. tail() failing inside map()'s own _map helper.
    rt.compilingPrelude = true;
    try {
      new Function("__py", preludeJs)(rt);
    } catch (e: unknown) {
      throw new Py2JsRunError(
        "runtime",
        e instanceof Error ? `${e.name}: ${e.message}` : String(e),
      );
    } finally {
      rt.compilingPrelude = false;
    }
  }

  return { rt, script };
}

function prepare(
  code: string,
  variant: number,
  mode: CompileMode,
  options: RunPy2JsOptions,
): { rt: Py2JsRuntime; js: string } {
  const { rt, script } = setupRuntime(code, variant, options);
  const js = compileScript(rt, script, variant, mode);
  return { rt, js };
}

/**
 * Async counterpart to `prepare()`, used only by runCodePy2JsDual: after
 * `setupRuntime`, parses the main script and — only if it has a local
 * (level > 0) import anywhere — flattens it first via bundleLocalImports
 * (src/modules/localImports.ts), a pure source-to-source transform, and
 * reparses the result; `__program__` is updated to that flattened text so
 * it can be shown to students. Either way, what gets resolved/compiled from
 * here on is just an ordinary single-file program — level === 0
 * (conductor-module) imports are a separate, pre-existing concern this
 * function has never touched (and still doesn't): the one-shot API has no
 * async pre-pass for those, on purpose, matching its behavior before this
 * feature existed. This is why the sync `prepare()`/`runCodePy2Js` above
 * cannot support `options.files`/`fileGetter` at all: resolving a local
 * import may need to bundle another file's contents in first, which is
 * inherently async.
 */
async function prepareDual(
  code: string,
  variant: number,
  options: RunPy2JsOptions,
): Promise<{ rt: Py2JsRuntime; js: string }> {
  const { rt, script } = setupRuntime(code, variant, options);

  let ast;
  try {
    ast = parse(script);
  } catch (e: unknown) {
    throw new Py2JsRunError("parse", String((e as { message?: string })?.message ?? e));
  }

  let effectiveScript = script;
  if (hasLocalImports(ast.statements)) {
    const entrypointFilePath = options.entrypointFilePath ?? "/main.py";
    try {
      effectiveScript = await bundleLocalImports(
        script,
        entrypointFilePath,
        toFileGetter(options),
        variant,
      );
    } catch (e: unknown) {
      throw new Py2JsRunError("analysis", (e as Error)?.message ?? String(e));
    }
    rt.builtins.__program__ = effectiveScript;
    try {
      ast = parse(effectiveScript);
    } catch (e: unknown) {
      throw new Py2JsRunError("parse", String((e as { message?: string })?.message ?? e));
    }
  }

  const priorGlobals = Object.keys(rt.globals);
  const resolver = new Resolver(
    effectiveScript,
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
    const js = compileProgram(ast, Object.keys(rt.builtins), {
      mode: "dual",
      repl: { priorGlobals },
    });
    return { rt, js };
  } catch (e: unknown) {
    if (e instanceof Py2JsCompileError) throw new Py2JsRunError("analysis", e.message);
    throw e;
  }
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
  const { rt, js } = await prepareDual(code, variant, options);
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
  /** Forwarded to the runtime's onPendingWorkChange (see its own doc comment
   * on Py2JsRuntime) — the conductor evaluator wires this to
   * BasicEvaluator's beginPendingWork()/endPendingWork(). */
  onPendingWorkChange?: (delta: 1 | -1) => void;
  /**
   * Conductor's module-interop protocol (pairs/arrays/closures/opaques) —
   * see conductor/GenericDataHandler.ts. Defaults to a fresh
   * GenericDataHandler; the conductor evaluator supplies its own instance so
   * the same handler backs both `context.evaluator`-equivalent conversions
   * and the ModuleLoaderRunnerPlugin registration (they must be the same
   * object — see PyCseEvaluatorBase for the identical requirement).
   */
  dataHandler?: IDataHandler;
  /**
   * Resolves one input() call with what the user typed — forwarded to
   * Py2JsRuntime.requestInput (see runtime.ts's doc comment on the field).
   * The conductor evaluator (Py2JsEvaluator.ts) supplies
   * `prompt => this.conductor.requestInput(prompt)`; left unset for
   * standalone/test use, in which case input() raises RuntimeError.
   */
  requestInput?: (prompt?: string) => Promise<string>;
  /**
   * The host conductor's data visualizer plugin, threaded down to draw_data (bridged as one of the
   * LINKED_LISTS group's native builtins — see stdlibBridge.ts's nativeDrawData). The conductor
   * evaluator (Py2JsEvaluator.ts) registers and supplies its own instance for chapter 2+, mirroring
   * PyCseEvaluatorBase's identical registration; left unset for standalone/test use (runCodePy2Js et
   * al. never pass one), in which case draw_data is a silent no-op.
   */
  dataVisualizer?: BaseDataVisualizerRunnerPlugin<PyValue>;
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
 *
 * A chunk with `from X import y` is loaded before it compiles: `level > 0`
 * (a local file) is flattened away entirely by bundleLocalImports
 * (src/modules/localImports.ts, a pure source-to-source transform — see its
 * own doc comment) before this chunk is even parsed for real; `level === 0`
 * (a conductor module — including one hoisted out of a bundled dependency
 * file) is loaded the same way it always has been, via
 * moduleInterop.ts's loadChunkImports. Either kind of import forces this
 * chunk onto the dual (async) compile spine so its FromImport-bound
 * bindings are callable via `acall`; every other chunk stays on the fast
 * sync path (see compiler.ts's mode doc and the engine README's module-
 * interop notes on why this crosses one unavoidable microtask per call
 * regardless).
 */
export class Py2JsSession {
  readonly rt: Py2JsRuntime;
  private readonly variant: number;
  private readonly groups: Group[];
  private readonly dataHandler: IDataHandler;
  /** Every chunk this session runs is resolved as if it were this path's own
   * content, for the purposes of relative-import resolution (what directory
   * "." means). Mutable: the conductor evaluator doesn't learn the real
   * entrypoint path until its own evaluateFile(fileName, ...) override — the
   * host's own file-naming choice, called after this session already
   * exists — so it calls setEntrypointFilePath() first. Defaults to
   * "/main.py" for callers (runCodePy2JsDual, tests) that never do. */
  private entrypointFilePath: string;
  /** Resolves a sibling file a local import needs — see
   * src/modules/localImports.ts's LocalFileGetter. Fixed at construction
   * (unlike entrypointFilePath):
   * the conductor evaluator already has `conductor` in its own constructor,
   * so `path => conductor.requestFile(path)` is available immediately. */
  private readonly fileGetter: (path: string) => Promise<string | undefined>;
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
    this.dataHandler = options.dataHandler ?? new GenericDataHandler();
    this.entrypointFilePath = options.entrypointFilePath ?? "/main.py";
    this.fileGetter = toFileGetter(options);
    this.rt = new Py2JsRuntime(variant >= 3);
    this.rt.onOutput = options.onOutput;
    this.rt.onPendingWorkChange = options.onPendingWorkChange;
    this.rt.requestInput = options.requestInput;

    // Same builtin layering as prepare(): bridged stdlib under the native
    // core, extraBuiltins over everything. The bridge's source string is
    // empty — its synthetic error nodes never point at real chunk text.
    const bridged = bridgeStdlibGroups(this.rt, this.groups, "", variant, options.dataVisualizer);
    for (const [name, value] of Object.entries(bridged)) {
      if (!(name in this.rt.builtins)) this.rt.builtins[name] = value;
    }
    const extra = options.extraBuiltins;
    const extraResolved = typeof extra === "function" ? extra(this.rt) : (extra ?? {});
    for (const [name, value] of Object.entries(extraResolved)) {
      this.rt.builtins[name] = annotateHostFunction(name, value);
    }
  }

  /** Sets what path a relative import (`from .foo import x`) run against this
   * session resolves against — the conductor evaluator calls this from its
   * evaluateFile(fileName, ...) override, since it only learns the host's
   * chosen entrypoint path then, after this session already exists. */
  setEntrypointFilePath(path: string): void {
    this.entrypointFilePath = path;
  }

  /** `__program__` is simply "the single string Python program that gets
   * compiled to JS" — runChunkInternal is the only caller, setting this
   * from whatever text it's actually about to compile for a given chunk
   * (see its own comment); no external caller needs to (or should) manage
   * this separately, exactly mirroring how the CSE machine keeps its own
   * `__program__` current internally (interpreter.ts's own
   * pyDefineVariable("__program__", ...)). */
  private setProgramText(text: string): void {
    this.rt.builtins.__program__ = text;
  }

  /** Compile and run one chunk against the persistent globals. */
  async runChunk(code: string): Promise<void> {
    if (!this.preludeLoaded) {
      this.preludeLoaded = true;
      const preludeText = this.groups
        .map(g => g.prelude ?? "")
        .filter(p => p.trim())
        .join("\n");
      if (preludeText.trim()) {
        // Marks every function this defines pyPrelude: true (see Py2JsRuntime.def) — the
        // Py2JsSession analogue of setupRuntime's identical wrapping around its own,
        // separate prelude-loading call above. Without this, a bridged builtin's error
        // can never name the predefined function it happened inside of (py-slang#397)
        // for any conductor-evaluator session, since that's the only path they use.
        this.rt.compilingPrelude = true;
        try {
          await this.runChunkInternal(preludeText);
        } finally {
          this.rt.compilingPrelude = false;
        }
      }
    }
    await this.runChunkInternal(code);
  }

  private async runChunkInternal(code: string): Promise<void> {
    let script = code.endsWith("\n") ? code : code + "\n";
    let ast = parse(script);

    // Local (level > 0) imports are flattened away entirely before anything
    // else happens — a pure source-to-source transform (see
    // src/modules/localImports.ts), so everything below sees an ordinary
    // single-file program either way. `priorGlobalNames` (this session's
    // existing globals) lets a dependency already bundled by an earlier
    // chunk be recognized and skipped rather than re-bundled/re-run.
    if (hasLocalImports(ast.statements)) {
      script = await bundleLocalImports(
        script,
        this.entrypointFilePath,
        this.fileGetter,
        this.variant,
        new Set(Object.keys(this.rt.globals)),
      );
      ast = parse(script);
    }

    // __program__ is simply "the single string Python program that gets
    // compiled to JS" — set here, unconditionally, from whatever that
    // actually is for this call (the chunk's own text, or the flattened
    // text if it just got bundled), exactly mirroring the CSE machine's own
    // pyDefineVariable("__program__", ...) (interpreter.ts): the engine
    // itself keeps this current, so no external caller (the conductor
    // evaluator's evaluateFile, in particular) has to remember to.
    this.setProgramText(script);

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

    // level === 0 (conductor-module) imports — including any the flattening
    // above hoisted out of a bundled dependency file — are unaffected by
    // any of this: still loaded and bound exactly as they always have been.
    const imports = hasImports(ast.statements);
    if (imports) {
      const bindings = await loadChunkImports(this.rt, this.dataHandler, ast.statements);
      this.rt.setPendingImports(bindings);
    }

    // input() is asyncOnly, exactly like an imported module function
    // (runtime.ts's doc comment on the native builtin core) — a chunk that
    // calls it anywhere, at any nesting depth, must compile on the async
    // spine even with no imports of its own. referencedNames already saw
    // every such reference during the resolve() call above (including
    // inside nested function bodies), so this needs no second AST walk.
    if (imports || resolver.referencedNames.has("input")) {
      const js = compileProgram(ast, Object.keys(this.rt.builtins), {
        mode: "dual",
        repl: { priorGlobals },
      });
      await new AsyncFunction("__py", js)(this.rt);
      return;
    }

    const js = compileProgram(ast, Object.keys(this.rt.builtins), {
      mode: "sync",
      repl: { priorGlobals },
    });
    new Function("__py", js)(this.rt);
  }
}
