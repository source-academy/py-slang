import { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { ModuleLoaderRunnerPlugin } from "@sourceacademy/runner-module-loader";
import { StmtNS } from "../ast-types";
import { moduleToPvml } from "../engines/pvml/modules";
import { PVMLBoxType } from "../engines/pvml/types";
import { PVMLCompiler } from "../engines/pvml/pvml-compiler";
import { PVMLInterpreter } from "../engines/pvml/pvml-interpreter";
import { parse } from "../parser/parser-adapter";
import { analyzeWithEnvironments } from "../resolver";
import linkedList from "../stdlib/linked-list";
import list from "../stdlib/list";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import pairmutator from "../stdlib/pairmutator";
import parser from "../stdlib/parser";
import stream from "../stdlib/stream";
import { Group } from "../stdlib/utils";
import { EvaluatorError } from "./errors";
import { PyDataHandlerEvaluator } from "./PyDataHandlerEvaluator";

function once(fn: () => Promise<void>): () => Promise<void> {
  let promise: Promise<void> | undefined;
  return () => (promise ??= fn());
}

/**
 * Compiles Python to PVML bytecode and runs it on PVMLInterpreter, a
 * pure-TypeScript bytecode VM (no WASM, no native binary — runs directly
 * wherever this evaluator is loaded, e.g. in the browser).
 *
 * Mirrors PyCseEvaluatorBase's persistence model (see PyCseEvaluator.ts) but
 * adapted to a compiled/bytecode pipeline instead of a tree-walking
 * interpreter: one persistent `globalEnv` (a dynamically-growable,
 * name-indexed global environment — see PVMLInterpreter's `globalEnv` field
 * and PVMLCompiler's `useGlobalMap` mode) survives across evaluateChunk()
 * calls, and each group's SICPy prelude source is compiled and run into it
 * exactly once, memoized via `once()` just like the CSE evaluator's
 * `ensurePreludesLoaded`. A later chunk sees every name — variable or
 * function — any earlier chunk (or the prelude) defined, the same way a
 * CSE-machine REPL chunk sees an earlier one's global bindings.
 *
 * `PyPvmlEvaluatorBase` mirrors `PyCseEvaluatorBase`'s (variant, groups)
 * parameterization exactly — see `PyPvmlEvaluator1..4` below, one per SICPy
 * chapter, matching `VARIANT_GROUPS` in ../runner.ts.
 *
 * Module imports (`from runes import heart`) follow the CSE evaluator's
 * two-phase model (see evaluateImports in src/engines/cse/interpreter.ts):
 * all loading happens *before* execution — `loadImports` collects the
 * chunk's FromImport statements, fetches each module through conductor's
 * ModuleLoaderRunnerPlugin, converts its exports to PVML values (see
 * src/engines/pvml/modules.ts) and seeds them into `globalEnv`, where the
 * already-compiled LDGG loads for the imported names find them (the
 * FromImport statement itself compiles to nothing — see the compiler's
 * visitFromImportStmt). Execution then uses the interpreter's executeAsync
 * so calls *to* the imported (async, conductor-side) functions can be
 * awaited mid-run. Extending PyDataHandlerEvaluator (rather than
 * BasicEvaluator directly) supplies the IDataHandler half of
 * IInterfacableEvaluator that ModuleLoaderRunnerPlugin requires.
 */
abstract class PyPvmlEvaluatorBase extends PyDataHandlerEvaluator {
  private readonly variant: number;
  private readonly groups: Group[];
  private globalEnv = new Map<string, PVMLBoxType>();
  private readonly preludeText: string;
  private readonly ensurePreludeLoaded: () => Promise<void>;
  /** This evaluator's own ModuleLoaderRunnerPlugin registration — see
   * loadImports for why the static singleton is deliberately not used. */
  private moduleLoader?: ModuleLoaderRunnerPlugin;

  protected constructor(conductor: IRunnerPlugin, variant: number, groups: Group[]) {
    super(conductor);
    this.variant = variant;
    this.groups = groups;
    this.preludeText = groups
      .map(g => g.prelude ?? "")
      .filter(p => p.trim())
      .join("\n");
    this.ensurePreludeLoaded = once(async () => {
      if (this.preludeText.trim()) {
        await this.runChunk(this.preludeText);
      }
    });
  }

  /** Compiles and runs one chunk of SICPy source against the persistent
   * `globalEnv`, seeding the resolver with whatever names are already there
   * (from the prelude, earlier chunks, or imported modules) so this chunk
   * can reference them. `ast` may be supplied by a caller that already
   * parsed `script` (evaluateChunk parses once and shares the tree with
   * loadImports); it must be the parse of `script` + trailing newline. */
  private async runChunk(script: string, ast?: StmtNS.FileInput): Promise<PVMLBoxType> {
    const source = script.endsWith("\n") ? script : script + "\n";
    ast ??= parse(source);
    const { errors, environments } = analyzeWithEnvironments(
      ast,
      source,
      this.variant,
      this.groups,
      [],
      Array.from(this.globalEnv.keys()),
    );
    if (errors.length > 0) {
      throw errors[0];
    }
    const compiler = PVMLCompiler.fromProgram(ast, this.variant, environments, true);
    const program = compiler.compileProgram(ast);
    const interpreter = new PVMLInterpreter(program, {
      sendOutput: msg => this.conductor.sendOutput(msg),
      globalEnv: this.globalEnv,
      programText: script,
      variant: this.variant,
    });
    const result = await interpreter.executeAsync();
    this.globalEnv = interpreter.getGlobalEnv();
    return result;
  }

  /** Loads every module named by a `from X import a, b as c` statement in
   * the chunk and seeds the imported bindings into `globalEnv`, before the
   * chunk runs — the PVML analogue of the CSE machine's evaluateImports.
   * A chunk with no FromImport statements never touches the module loader
   * (so evaluators on conductors without plugin support — e.g. unit-test
   * mocks — work unchanged as long as no imports appear). */
  private async loadImports(ast: StmtNS.FileInput): Promise<void> {
    const importsByModule = new Map<string, { name: string; alias: string | undefined }[]>();
    for (const stmt of ast.statements) {
      if (stmt instanceof StmtNS.FromImport) {
        const moduleName = stmt.module.lexeme;
        if (!importsByModule.has(moduleName)) {
          importsByModule.set(moduleName, []);
        }
        importsByModule
          .get(moduleName)!
          .push(...stmt.names.map(spec => ({ name: spec.name.lexeme, alias: spec.alias?.lexeme })));
      }
    }
    if (importsByModule.size === 0) {
      return;
    }

    // Registered lazily on first actual import rather than in the
    // constructor (registration is only needed — or possible — on a real
    // conductor), but exactly once per *evaluator instance*, holding the
    // returned plugin rather than reading the static
    // ModuleLoaderRunnerPlugin.instance: the plugin permanently captures the
    // evaluator (IDataHandler) it was registered with, so a stale singleton
    // from an earlier evaluator would register loaded modules against that
    // old evaluator's pair/closure/opaque stores — values this evaluator
    // could then never resolve ("Invalid pair identifier").
    this.moduleLoader ??= this.conductor.registerPlugin(
      ModuleLoaderRunnerPlugin,
      this.conductor,
      this,
    );
    const loader = this.moduleLoader;

    await Promise.all(
      [...importsByModule].map(async ([moduleName, specs]) => {
        let exports;
        try {
          exports = (await loader.requestModule(moduleName)).exports;
        } catch {
          // Same wording as the CSE machine's ModuleNotFoundError.
          throw new Error(`Module "${moduleName}" not found.`);
        }
        const bySymbol = new Map(exports.map(e => [e.symbol, e]));
        for (const spec of specs) {
          const entry = bySymbol.get(spec.name);
          if (!entry) {
            throw new Error(`Module "${moduleName}" has no export named "${spec.name}".`);
          }
          this.globalEnv.set(
            spec.alias ?? spec.name,
            await moduleToPvml(this, entry.value, spec.name),
          );
        }
      }),
    );
  }

  async evaluateChunk(chunk: string): Promise<void> {
    try {
      await this.ensurePreludeLoaded();
      const ast = parse(chunk.endsWith("\n") ? chunk : chunk + "\n");
      await this.loadImports(ast);
      const returnValue = await this.runChunk(chunk, ast);
      this.conductor.sendResult(PVMLInterpreter.toJSValue(returnValue));
    } catch (e) {
      this.conductor.sendError(new EvaluatorError(e));
    }
  }
}

export class PyPvmlEvaluator1 extends PyPvmlEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 1, [misc, math]);
  }
}

export class PyPvmlEvaluator2 extends PyPvmlEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 2, [misc, math, linkedList]);
  }
}

export class PyPvmlEvaluator3 extends PyPvmlEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 3, [misc, math, linkedList, list, pairmutator, stream]);
  }
}

export class PyPvmlEvaluator4 extends PyPvmlEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 4, [misc, math, linkedList, list, pairmutator, stream, parser]);
  }
}

/** @deprecated Use PyPvmlEvaluator4 (or the chapter-appropriate variant)
 * instead — kept as an alias so existing callers of the single hardcoded-
 * chapter-4 evaluator don't break. */
export class PyPvmlEvaluator extends PyPvmlEvaluator4 {}
