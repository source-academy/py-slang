import { BasicEvaluator, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import type { PyodideInterface } from "pyodide";
import type { PyProxy } from "pyodide/ffi";
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
 * py2js's PY2JS_GROUPS) — used here only so the Resolver recognizes names
 * like `print`/`len` as valid for the chapter; pyodide runs on real CPython,
 * so these groups' actual implementations are never bridged in or executed. */
const CHAPTER_GROUPS: Record<number, Group[]> = {
  1: [misc, math],
  2: [misc, math, linkedList],
  3: [misc, math, linkedList, list, pairmutator, stream],
  4: [misc, math, linkedList, list, pairmutator, stream, parserGroup],
};

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
 * chunk that passes that check actually runs, on pyodide, unmodified.
 * PyodideEvaluatorFull skips the check entirely: full, unrestricted Python
 * ("Python Full" in the language directory, not one of the four chapters).
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
  /** Private namespace the install-helper snippet runs in, so its own
   * `importlib`/`micropip`/loop-variable names never show up in — or risk
   * colliding with a name in — the user's own global namespace. Created
   * lazily since it needs a live pyodide instance. */
  private internalNamespace?: PyProxy;

  constructor(conductor: IRunnerPlugin) {
    super(conductor);
    this.pyodide = loadPyodideGeneric().then(async pyodide => {
      await pyodide.loadPackage("micropip");
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
    except Exception:
        _sa_missing.append(_sa_mod)
if _sa_missing:
    await micropip.install(_sa_missing)
`;
    await pyodide.runPythonAsync(installerCode, { globals: this.getInternalNamespace(pyodide) });
    candidates.forEach(root => this.resolvedRoots.add(root));
  }

  /** Every non-dunder name currently bound in the user's global namespace —
   * `__import__('json')` (an expression, not an `import` statement) is used
   * so the query itself never binds a `json` name into that namespace. */
  private currentGlobalNames(pyodide: PyodideInterface): string[] {
    const json = pyodide.runPython(
      "__import__('json').dumps([k for k in globals() if not (k.startswith('__') and k.endswith('__'))])",
    ) as string;
    return JSON.parse(json) as string[];
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
    super(conductor);
    this.chapter = chapter;
    this.groups = CHAPTER_GROUPS[chapter] ?? [];
  }

  protected validateChunk(chunk: string, moduleNames: string[]): void {
    const script = chunk.endsWith("\n") ? chunk : chunk + "\n";
    const ast = parse(script);
    const errors = analyze(ast, script, this.chapter, this.groups, [], moduleNames);
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
 * PyodideEvaluatorBase). */
export class PyodideEvaluatorFull extends PyodideEvaluatorBase {
  protected validateChunk(): void {
    // No-op: Python Full accepts anything CPython itself accepts.
  }
}
