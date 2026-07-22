import { BasicEvaluator, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import type { PyodideInterface } from "pyodide";
import type { PyProxy } from "pyodide/ffi";
import { StmtNS } from "../ast-types";
import { getImportRoots } from "../engines/pyodide/importAnalyzer";
import { loadPyodideGeneric } from "../engines/pyodide/loadPyodide";
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
  return [...groups.flatMap(g => [...g.builtins.keys()]), ...(CHAPTER_PRELUDE_NAMES[chapter] ?? [])];
}

/**
 * Runs Python on real CPython via pyodide (CPython compiled to WebAssembly),
 * rather than through py-slang's own interpreter/compiler — full stdlib and
 * real `import numpy`-style packages (fetched via micropip), at the cost of
 * Source Academy's own JS-based modules (Rune, Curve, ...) not being
 * loadable: pyodide only reaches PyPI packages, not conductor's module
 * protocol. See issue #11.
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

  /** @param sicpModules Which `sourceacademy-sicp` submodules to bridge into
   * the user's global namespace at startup — a chapter's own module list
   * (see SICP_MODULE_BY_GROUP), or `"*"` for the whole package
   * (PyodideEvaluatorFull). */
  constructor(conductor: IRunnerPlugin, sicpModules: readonly string[] | "*") {
    super(conductor);
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

  /** Installs (via micropip) whichever top-level modules `chunk` imports
   * that aren't already available, so the actual run below never hits a
   * ModuleNotFoundError for a real PyPI package. */
  private async installMissingImports(pyodide: PyodideInterface, chunk: string): Promise<void> {
    const roots = await getImportRoots(pyodide, chunk);
    const candidates = [...roots].filter(root => !this.resolvedRoots.has(root));
    if (candidates.length === 0) return;

    const installerCode = `
import importlib, micropip
_sa_missing = []
for _sa_mod in ${JSON.stringify(candidates)}:
    try:
        importlib.import_module(_sa_mod)
    except ModuleNotFoundError:
        _sa_missing.append(_sa_mod)
if _sa_missing:
    await micropip.install(_sa_missing)
`;
    await pyodide.runPythonAsync(installerCode, { globals: this.getInternalNamespace(pyodide) });
    candidates.forEach(root => this.resolvedRoots.add(root));
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
      await pyodide.runPythonAsync(chunk);
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
    super(conductor, "*");
  }

  protected validateChunk(): void {
    // No-op: Python Full accepts anything CPython itself accepts.
  }
}
