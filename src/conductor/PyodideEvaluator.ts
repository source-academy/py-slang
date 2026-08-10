import { BasicEvaluator, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { ModuleLoaderRunnerPlugin } from "@sourceacademy/runner-module-loader";
import type { PyodideInterface } from "pyodide";
import type { PyProxy } from "pyodide/ffi";
import { StmtNS } from "../ast-types";
import { getImportRoots } from "../engines/pyodide/importAnalyzer";
import { loadPyodideGeneric } from "../engines/pyodide/loadPyodide";
import { isJspiAvailable, registerModule } from "../engines/pyodide/moduleInterop";
import { parse } from "../parser/parser-adapter";
import { analyze } from "../resolver/analysis";
import linkedList from "../stdlib/linked-list";
import list from "../stdlib/list";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import pairmutator from "../stdlib/pairmutator";
import parserGroup from "../stdlib/parser";
import stream from "../stdlib/stream";
import { Group } from "../stdlib/utils";
import { EvaluatorError } from "./errors";
import { asInterfacableEvaluator, GenericDataHandler } from "./GenericDataHandler";
import { registerAutoCompletePlugin } from "./plugins/autocomplete";
import { FULL_PYTHON_VARIANT } from "./plugins/autocomplete/keywords";

/** Same per-chapter stdlib surface as every other engine (PyCseEvaluator.ts,
 * py2js's PY2JS_GROUPS) — used here so the Resolver recognizes names like
 * `print`/`pair`/`length` as valid for the chapter. Doubles as the source
 * for which `sourceacademy-sicp` submodules get bridged into pyodide (see
 * SICP_MODULE_BY_GROUP below) — one table drives both, so the names the
 * Resolver accepts and the names actually bound in pyodide can't drift
 * apart from each other. */
const CHAPTER_GROUPS: Record<number, Group[]> = {
  1: [misc, math],
  2: [misc, math, linkedList],
  3: [misc, math, linkedList, list, pairmutator, stream],
  4: [misc, math, linkedList, list, pairmutator, stream, parserGroup],
};

/** The `sourceacademy-sicp` (python/) submodule backing each stdlib group —
 * see that package's own `__init__.py` docstring, which documents this same
 * correspondence, and scripts/jsdoc.sh, which independently encodes it a
 * third time for the generated docs site. */
const SICP_MODULE_BY_GROUP = new Map<Group, string>([
  [misc, "misc"],
  [math, "math"],
  [linkedList, "linked_list"],
  [pairmutator, "pair_mutators"],
  [list, "list"],
  [stream, "stream"],
  [parserGroup, "mce"],
]);

/** Hard-pinned, not floating: the evaluator should never silently pick up a
 * newer sourceacademy-sicp release than whatever py-slang's own tests (the
 * name-parity check in PyodideEvaluator.test.ts, and this file's
 * CHAPTER_GROUPS) were actually written against. Bump deliberately. */
const SICP_VERSION = "0.1.0";

/** A stdlib group's `prelude` (SICPy source defining higher-level functions
 * in terms of the group's own primitives, e.g. linked-list.prelude.ts's
 * map/filter/reduce) is never executed here — real CPython + the bridged
 * sourceacademy-sicp package already provide working implementations. But
 * the Resolver still needs to know these names exist, the same way CSE/py2js
 * pass their prelude's *executed* environment as preludeNames; since nothing
 * here executes the prelude, this parses it (with py-slang's own parser —
 * prelude source is by construction valid SICPy) and collects its top-level
 * def names statically instead. Internal helpers (leading `_`, e.g.
 * linked-list.prelude.ts's `_length`) are excluded, matching every native
 * builtins list's own `!name.startsWith("_")` filter. */
function preludeTopLevelNames(preludeSource: string): string[] {
  if (!preludeSource.trim()) return [];
  const script = preludeSource.endsWith("\n") ? preludeSource : preludeSource + "\n";
  const ast = parse(script);
  return ast.statements
    .filter((s): s is StmtNS.FunctionDef => s instanceof StmtNS.FunctionDef)
    .map(s => s.name.lexeme)
    .filter(name => !name.startsWith("_"));
}

/** Precomputed once (prelude parsing has a real, if small, cost) rather than
 * per evaluateChunk call — every chapter's group list is static. */
const CHAPTER_PRELUDE_NAMES: Record<number, string[]> = Object.fromEntries(
  Object.entries(CHAPTER_GROUPS).map(([chapter, groups]) => [
    chapter,
    groups.flatMap(g => preludeTopLevelNames(g.prelude)),
  ]),
);

/** Every name the Resolver accepts for `chapter` (native builtins + prelude
 * top-level defs) — exported for PyodideEvaluator.test.ts's name-parity
 * check: every one of these should also resolve to a real, bound name in
 * pyodide once this chapter's sourceacademy-sicp modules are bridged in.
 * A name passing validation but not actually being bound (or vice versa) is
 * exactly the class of bug this exists to catch — see class doc below. */
export function chapterExpectedNames(chapter: number): string[] {
  const groups = CHAPTER_GROUPS[chapter] ?? [];
  return [
    ...groups.flatMap(g => [...g.builtins.keys()]),
    ...(CHAPTER_PRELUDE_NAMES[chapter] ?? []),
  ];
}

/**
 * Runs Python on real CPython via pyodide (CPython compiled to WebAssembly),
 * rather than through py-slang's own interpreter/compiler — full stdlib and
 * real `import numpy`-style packages (fetched via micropip), *and* Source
 * Academy's own JS-backed modules (Rune, Curve, ...) via conductor's module
 * protocol (see src/engines/pyodide/moduleInterop.ts's class doc for the
 * conversion layer and issue #11's history — this used to be the one gap
 * relative to every other engine).
 *
 * A conductor module and a PyPI package are both just `from X import Y` to
 * the student, and both go through the same import-root detection
 * (importAnalyzer.ts's getImportRoots, run once per chunk): for each not
 * -yet-resolved root, installMissingImports tries conductor's own module
 * loader first (tryRegisterConductorModule) and only falls back to
 * micropip when that root isn't a recognised SA module — so a conductor
 * without module support (e.g. a bare unit-test mock) degrades to exactly
 * today's PyPI-only behaviour, root by root.
 *
 * Calling *into* an imported module's function needs pyodide's
 * `run_sync`/JSPI stack-switching bridge (see moduleInterop.ts) — once any
 * chunk in this evaluator's session has imported a conductor module,
 * `runChunk` routes every later chunk through a `callPromising`-invoked
 * exec wrapper instead of the plain `runPythonAsync` path, so `run_sync`
 * has the stack-switching context it needs regardless of which chunk
 * actually calls a module function (REPL persistence means an import in
 * chunk 1 can be called from chunk 5 with no import statement of its own).
 * On a JS engine without JSPI, that wrapper is skipped entirely (constants/
 * values imported from a module still bind and work fine); only an actual
 * call into a module function that needs the async bridge fails, with the
 * same clear error `_SaClosure.__call__`'s `run_sync` raises on its own.
 *
 * PyodideEvaluator1-4 gate every chunk through the same parser + Resolver
 * (resolver/analysis.ts's `analyze`) every other engine uses, with that
 * chapter's feature validators — so "Python §N" still means the restricted
 * SICPy subset even though CPython itself would happily run more. Only a
 * chunk that passes that check actually runs, on pyodide.
 *
 * SICPy-specific names (`pair`, `head`, `length`, ...) aren't real CPython —
 * validation accepting them isn't enough to make them work. Each evaluator
 * bridges the `sourceacademy-sicp` PyPI package (source at python/, see its
 * own README) into pyodide's global namespace once, at startup: the exact
 * submodules `SICP_MODULE_BY_GROUP` says this chapter's groups map to (or,
 * for PyodideEvaluatorFull, the whole package). It's a real, independently
 * tested CPython implementation of the same stdlib — not reimplemented here,
 * just wired in — so this is the one place chapters 2-4 depend on it having
 * stayed in sync with py-slang's own stdlib groups (see PyodideEvaluator.test.ts's
 * name-parity check).
 *
 * PyodideEvaluatorFull skips the chapter feature gate entirely: full,
 * unrestricted Python ("Python Full" in the language directory, not one of
 * the four chapters).
 *
 * REPL persistence: unlike the other engines, there is no py-slang-side
 * runtime object holding prior chunks' globals — that state lives inside
 * pyodide's own global namespace, which persists across evaluateChunk calls
 * on its own. The Resolver, however, is a fresh instance per chunk and has
 * no memory of it, so `definedNames` mirrors pyodide's globals() back into
 * the Resolver's `moduleNames` parameter after every chunk (successful or
 * not — CPython doesn't roll back names already bound before a later error
 * in the same chunk), exactly the role PyPvmlEvaluatorBase/Py2JsSession's
 * own `priorGlobals` play for their engines.
 *
 * Exec-style, like the other non-CSE engines: a chunk reports no result
 * value (`sendResult(undefined)`); anything it prints goes to stdout, piped
 * through pyodide's own stdout hook into `conductor.sendOutput`.
 */
abstract class PyodideEvaluatorBase extends BasicEvaluator {
  private readonly pyodide: Promise<PyodideInterface>;
  /** Roots already confirmed importable (stdlib or already installed), so a
   * later chunk re-importing the same package skips micropip entirely. */
  private readonly resolvedRoots = new Set<string>();
  /** Top-level names bound so far, across every prior chunk — see class doc. */
  private readonly definedNames = new Set<string>();
  /** Private namespace the install-helper snippet (and the one-time sicp
   * install below) run in, so their own `importlib`/`micropip`/loop-variable
   * names never show up in — or risk colliding with a name in — the user's
   * own global namespace. Created lazily since it needs a live pyodide
   * instance. */
  private internalNamespace?: PyProxy;
  /** Conductor's module-interop protocol (pairs/arrays/closures/opaques) —
   * see GenericDataHandler.ts and moduleInterop.ts's typedToPy/pythonToModule,
   * which is what actually reads/writes through this. */
  private readonly dataHandler: GenericDataHandler;
  /** This evaluator's own ModuleLoaderRunnerPlugin registration — lazy (only
   * needed once a chunk actually imports something unresolved), and one per
   * *instance* rather than reading a static singleton: the plugin permanently
   * captures the dataHandler it was registered with, and a stale singleton
   * from an earlier evaluator would register modules against that old
   * evaluator's identifier maps — same reasoning as PyPvmlEvaluatorBase's
   * identical field. */
  private moduleLoader?: ModuleLoaderRunnerPlugin;
  /** Conductor module (not PyPI package) root names already registered into
   * sys.modules — see tryRegisterConductorModule. */
  private readonly registeredModules = new Set<string>();
  /** Sticky for the life of this evaluator instance: once any chunk has
   * imported a conductor module, every later chunk must run through the
   * callPromising-wrapped path (see runChunk) even if that later chunk has
   * no FromImport of its own — REPL persistence means it could still call a
   * function an earlier chunk imported. */
  private hasImportedAnyModule = false;
  /** The exec-wrapper PyCallable (see runChunk) - defined once, lazily, in
   * the internal namespace so its own name never leaks into student globals
   * or Resolver-visible bindings. */
  private chunkRunner?: Promise<PyProxy>;

  /** @param sicpModules Which `sourceacademy-sicp` submodules to bridge into
   * the user's global namespace at startup — a chapter's own module list
   * (see SICP_MODULE_BY_GROUP), or `"*"` for the whole package
   * (PyodideEvaluatorFull).
   * @param variant Chapter number (or FULL_PYTHON_VARIANT) - both the
   * autocomplete variant and GenericDataHandler's own variant, matching
   * every other engine's evaluator (e.g. PyCseEvaluatorBase). */
  constructor(conductor: IRunnerPlugin, sicpModules: readonly string[] | "*", variant: number) {
    super(conductor);
    registerAutoCompletePlugin(conductor, variant);
    this.dataHandler = new GenericDataHandler(variant);
    this.pyodide = loadPyodideGeneric().then(async pyodide => {
      await pyodide.loadPackage("micropip");
      const ns = this.getInternalNamespace(pyodide);
      await pyodide.runPythonAsync(
        `import micropip\nawait micropip.install(${JSON.stringify(`sourceacademy-sicp==${SICP_VERSION}`)})\n`,
        { globals: ns },
      );
      const bridgeCode =
        sicpModules === "*"
          ? "from sicp import *\n"
          : sicpModules.map(m => `from sicp.${m} import *\n`).join("");
      await pyodide.runPythonAsync(bridgeCode);
      await pyodide.setStdout({
        batched: (output: string) => this.conductor.sendOutput(output),
      });
      return pyodide;
    });
  }

  /** Throws on a chunk this variant doesn't accept — a chapter's feature
   * gate, or nothing at all for the unrestricted Full variant. */
  protected abstract validateChunk(chunk: string, moduleNames: string[]): void;

  private getInternalNamespace(pyodide: PyodideInterface): PyProxy {
    this.internalNamespace ??= pyodide.toPy({}) as PyProxy;
    return this.internalNamespace;
  }

  private getModuleLoader(): ModuleLoaderRunnerPlugin {
    this.moduleLoader ??= this.conductor.registerPlugin(
      ModuleLoaderRunnerPlugin,
      this.conductor,
      asInterfacableEvaluator(this, this.dataHandler),
    );
    return this.moduleLoader;
  }

  /** True iff `root` names a conductor (Source Academy) module: registers it
   * into sys.modules (moduleInterop.ts's registerModule) on first success, so
   * a chunk's own `from <root> import x` resolves as ordinary CPython import
   * machinery from here on — including in a *later* chunk that never
   * re-requests it, matching pyodide's REPL persistence (unlike WASM/PVML,
   * which rebuild/reseed their bindings every chunk, there's no per-chunk
   * work left to do here once sys.modules has the real module object).
   * False for anything the module loader doesn't recognise, including a
   * conductor with no module support at all — installMissingImports then
   * falls back to treating `root` as an ordinary PyPI package, so a bare
   * unit-test mock conductor degrades to exactly today's PyPI-only
   * behaviour, root by root. */
  private async tryRegisterConductorModule(
    pyodide: PyodideInterface,
    root: string,
    loaderErrors: Map<string, unknown>,
  ): Promise<boolean> {
    if (this.registeredModules.has(root)) return true;
    let exportsList;
    try {
      exportsList = (await this.getModuleLoader().requestModule(root)).exports;
    } catch (e) {
      // Not necessarily "root isn't a Source Academy module" - could just as
      // well be a transport failure or an error inside the module's own
      // init. Either way installMissingImports falls back to micropip next;
      // stashing the real cause here means that fallback's own failure (the
      // common case for a root that *was* a real SA module) can report it
      // instead of only a misleading "not found on PyPI".
      loaderErrors.set(root, e);
      return false;
    }
    await registerModule(pyodide, this.dataHandler, root, exportsList);
    this.registeredModules.add(root);
    this.hasImportedAnyModule = true;
    return true;
  }

  /** Resolves whichever top-level modules `chunk` imports that aren't
   * already available: a conductor (Source Academy) module first
   * (tryRegisterConductorModule), falling back to a real PyPI package via
   * micropip — so the actual run below never hits a ModuleNotFoundError for
   * either kind. */
  private async installMissingImports(pyodide: PyodideInterface, chunk: string): Promise<void> {
    const roots = await getImportRoots(pyodide, chunk);
    const candidates = [...roots].filter(root => !this.resolvedRoots.has(root));
    if (candidates.length === 0) return;

    // Resolution-only: NOT importlib.import_module, which would fully import
    // (and execute) each candidate just to answer "does this exist" - a
    // heavy package would pay its import cost before the chunk even reaches
    // the statement, its own module-level output/errors would appear
    // detached from the student's code, and a candidate whose body raises
    // ModuleNotFoundError for its own missing transitive dependency would be
    // misclassified as "root not found" (sending it needlessly to micropip).
    // sys.modules is checked first so a conductor module already registered
    // by tryRegisterConductorModule still counts as present even though it's
    // a manually-built types.ModuleType with __spec__ set to None - which is
    // exactly the case find_spec itself can't handle (raises ValueError).
    const checkCode = `
import importlib.util
import sys
_sa_missing = []
for _sa_mod in ${JSON.stringify(candidates)}:
    if _sa_mod in sys.modules:
        continue
    try:
        if importlib.util.find_spec(_sa_mod) is None:
            _sa_missing.append(_sa_mod)
    except (ImportError, ValueError):
        _sa_missing.append(_sa_mod)
_sa_missing
`;
    const notYetImportable = (
      await pyodide.runPythonAsync(checkCode, { globals: this.getInternalNamespace(pyodide) })
    ).toJs() as string[];

    const loaderErrors = new Map<string, unknown>();
    const stillMissing: string[] = [];
    for (const root of notYetImportable) {
      if (!(await this.tryRegisterConductorModule(pyodide, root, loaderErrors))) {
        stillMissing.push(root);
      }
    }

    if (stillMissing.length > 0) {
      try {
        await pyodide.runPythonAsync(
          `import micropip\nawait micropip.install(${JSON.stringify(stillMissing)})\n`,
          { globals: this.getInternalNamespace(pyodide) },
        );
      } catch (installError) {
        // stillMissing's roots that DID reach the module loader (as opposed
        // to never being recognised as an SA module at all) had their real
        // failure reason swallowed above in favour of trying micropip - now
        // that micropip has ALSO failed, surface those original errors
        // rather than only micropip's "package not found", which is
        // misleading for a root that actually was a real SA module.
        const causes = stillMissing
          .map(root => loaderErrors.get(root))
          .filter((err): err is unknown => err !== undefined);
        if (causes.length === 0) throw installError;
        const detail = causes
          .map(err => (err instanceof Error ? err.message : String(err)))
          .join("; ");
        throw new Error(
          `${installError instanceof Error ? installError.message : String(installError)} (module loader also failed: ${detail})`,
        );
      }
    }

    candidates.forEach(root => this.resolvedRoots.add(root));
  }

  /** The exec-wrapper this.runChunk needs to invoke via callPromising —
   * defined once, lazily, in the internal namespace (never student globals):
   * takes the chunk source and the student's own globals dict as explicit
   * arguments and `exec`s against them directly, rather than inlining the
   * chunk as the wrapper function's own body. That distinction matters: a
   * naive `async def _sa_chunk(): <chunk statements>` would make Python's
   * ordinary function-scoping rules kick in (any name assigned anywhere in a
   * function is local to it unless declared `global`), silently breaking
   * REPL persistence for every chunk that both imports a module and assigns
   * a variable - confirmed empirically before writing this. `exec(code,
   * globals_dict)` has none of that: it runs `code` with true module-level
   * semantics against `globals_dict`, exactly like pyodide's own
   * runPython(Async) already does, just reachable from inside an
   * async-invoked function this time. */
  private async getChunkRunner(pyodide: PyodideInterface): Promise<PyProxy> {
    if (!this.chunkRunner) {
      const ns = this.getInternalNamespace(pyodide);
      this.chunkRunner = pyodide
        .runPythonAsync(
          // ast.PyCF_ALLOW_TOP_LEVEL_AWAIT matches the flag runPythonAsync
          // itself compiles with - without it, a chunk using top-level
          // `await` could succeed before this evaluator's first module
          // import (plain runPythonAsync path) and fail afterwards (this
          // wrapper's plain compile()), on the very same evaluator.
          'import ast\nasync def _sa_chunk_runner(source, globals_dict):\n    exec(compile(source, "<chunk>", "exec", flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT), globals_dict)\n',
          { globals: ns },
        )
        .then(() => ns.get("_sa_chunk_runner") as PyProxy);
    }
    return this.chunkRunner;
  }

  /** Runs `chunk` against the student's persistent global namespace. Once
   * this evaluator's session has ever imported a conductor module
   * (hasImportedAnyModule), every chunk from then on runs through the
   * callPromising-invoked exec wrapper instead of plain runPythonAsync, so
   * that IF this chunk calls into a module function needing pyodide's
   * run_sync/JSPI bridge (see moduleInterop.ts), the stack-switching context
   * it needs is already there — needed even for a chunk with no FromImport
   * of its own, since REPL persistence lets it call a name an earlier chunk
   * imported. Skipped when JSPI isn't available in this JS engine: constants/
   * values already bound from a module import still work fine either way;
   * only an actual call into a module function that needs the bridge fails,
   * with the same clear error run_sync itself raises (see
   * moduleInterop.ts's class doc) rather than this wrapper adding a second,
   * redundant failure mode on top. */
  private async runChunk(pyodide: PyodideInterface, chunk: string): Promise<void> {
    if (this.hasImportedAnyModule && (await isJspiAvailable(pyodide))) {
      const runner = await this.getChunkRunner(pyodide);
      await (
        runner as PyProxy & { callPromising(...a: unknown[]): Promise<unknown> }
      ).callPromising(chunk, pyodide.globals);
      return;
    }
    await pyodide.runPythonAsync(chunk);
  }

  /** Every non-dunder name currently bound in the user's global namespace.
   * Reads `pyodide.globals` from the JS side (rather than running Python
   * code that calls `globals()`) so a chunk that shadows the builtin — e.g.
   * `globals = 1` — can't break this: `toJs()` reflects the same underlying
   * dict object regardless of what name(s) point to it inside Python. */
  private currentGlobalNames(pyodide: PyodideInterface): string[] {
    const names = pyodide.globals.toJs({ dict_converter: Object.fromEntries }) as Record<
      string,
      unknown
    >;
    return Object.keys(names).filter(k => !(k.startsWith("__") && k.endsWith("__")));
  }

  async evaluateChunk(chunk: string): Promise<void> {
    try {
      this.validateChunk(chunk, [...this.definedNames]);
    } catch (e) {
      this.conductor.sendError(new EvaluatorError(e));
      return;
    }

    const pyodide = await this.pyodide;
    try {
      await this.installMissingImports(pyodide, chunk);
      await this.runChunk(pyodide, chunk);
      this.conductor.sendResult(undefined);
    } catch (e) {
      this.conductor.sendError(new EvaluatorError(e));
    } finally {
      this.currentGlobalNames(pyodide).forEach(name => this.definedNames.add(name));
    }
  }
}

abstract class ChapterPyodideEvaluator extends PyodideEvaluatorBase {
  private readonly chapter: number;
  private readonly groups: Group[];

  protected constructor(conductor: IRunnerPlugin, chapter: number) {
    const groups = CHAPTER_GROUPS[chapter] ?? [];
    super(
      conductor,
      groups.map(g => {
        const sicpModule = SICP_MODULE_BY_GROUP.get(g);
        if (!sicpModule) throw new Error(`No sourceacademy-sicp module registered for group`);
        return sicpModule;
      }),
      chapter,
    );
    this.chapter = chapter;
    this.groups = groups;
  }

  protected validateChunk(chunk: string, moduleNames: string[]): void {
    const script = chunk.endsWith("\n") ? chunk : chunk + "\n";
    const ast = parse(script);
    const preludeNames = CHAPTER_PRELUDE_NAMES[this.chapter] ?? [];
    const errors = analyze(ast, script, this.chapter, this.groups, preludeNames, moduleNames);
    if (errors.length > 0) throw errors[0];
  }
}

export class PyodideEvaluator1 extends ChapterPyodideEvaluator {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 1);
  }
}

export class PyodideEvaluator2 extends ChapterPyodideEvaluator {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 2);
  }
}

export class PyodideEvaluator3 extends ChapterPyodideEvaluator {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 3);
  }
}

export class PyodideEvaluator4 extends ChapterPyodideEvaluator {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 4);
  }
}

/** Full, unrestricted Python — no chapter feature gate (see class doc on
 * PyodideEvaluatorBase), and the whole sourceacademy-sicp package bridged in
 * rather than a chapter's subset. */
export class PyodideEvaluatorFull extends PyodideEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, "*", FULL_PYTHON_VARIANT);
  }

  protected validateChunk(): void {
    // No-op: Python Full accepts anything CPython itself accepts.
  }
}
