// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { BasicEvaluator, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { DataType, TypedValue } from "@sourceacademy/conductor/types";
import { ModuleLoaderRunnerPlugin } from "@sourceacademy/runner-module-loader";
import { StmtNS } from "../ast-types";
import { compileToWasmAndRun } from "../engines/wasm";
import { prepareModuleBindings, PreparedModuleBindings } from "../engines/wasm/moduleInterop";
import { parse } from "../parser/parser-adapter";
import linkedList from "../stdlib/linked-list";
import list from "../stdlib/list";
import pairmutator from "../stdlib/pairmutator";
import mce from "../stdlib/parser";
import { Group } from "../stdlib/utils";
import { asInterfacableEvaluator, GenericDataHandler } from "./GenericDataHandler";
import { EvaluatorError } from "./errors";

/**
 * Compiles Python to a WASM module and runs it via compileToWasmAndRun.
 *
 * Unlike PyCseEvaluatorBase/PyPvmlEvaluatorBase, each evaluateChunk/
 * evaluateFile call recompiles and reruns the *entire* prelude + chunk from
 * scratch (compileToWasmAndRun's own `script = prelude + "\n" + code`) —
 * there is no persistent global environment carried between calls, so a
 * chunk's imports never need to survive past that one call either.
 *
 * Module imports (`from X import y`) still follow the same two-phase model
 * as the CSE machine and PVML (see PyPvmlEvaluator.ts's loadImports): before
 * compiling, `loadImports` parses the chunk once to find its FromImport
 * statements, fetches each named module through conductor's
 * ModuleLoaderRunnerPlugin, and converts its exports into the WASM engine's
 * synchronous runtime-value form (see moduleInterop.ts's
 * prepareModuleBindings) — this is the async phase, done up front so the
 * compiled program's own `modules.get`/`modules.call` host imports (see
 * builderGenerator.ts's visitFromImportStmt) never need to await anything
 * except an actual module *function call* (via JSPI — see index.ts).
 * `dataHandler` is a GenericDataHandler, the same engine-agnostic IDataHandler
 * implementation PyCseEvaluatorBase/PyPvmlEvaluatorBase use.
 */
class PyWasmEvaluator extends BasicEvaluator {
  private readonly chapter: number;
  private readonly groups: Group[];
  /** See PyPvmlEvaluatorBase's identical field doc comment. */
  private readonly dataHandler = new GenericDataHandler();
  /** This evaluator's own ModuleLoaderRunnerPlugin registration — see
   * loadImports for why the static singleton is deliberately not used. */
  private moduleLoader?: ModuleLoaderRunnerPlugin;

  protected constructor(conductor: IRunnerPlugin, chapter: number, groups: Group[]) {
    super(conductor);
    this.chapter = chapter;
    this.groups = groups;
  }

  /** Finds every `from X import a, b as c` statement in `ast` and resolves
   * its bindings into a PreparedModuleBindings, or undefined if the chunk
   * has no imports at all (compileToWasmAndRun then gets no
   * `moduleBindings`, and the compiled program's own uses of an import —
   * if any — fail loudly instead of silently). Mirrors
   * PyPvmlEvaluatorBase's loadImports, but returns the prepared bindings
   * rather than mutating a persistent environment, since there is none
   * here to mutate. */
  private async loadImports(ast: StmtNS.FileInput): Promise<PreparedModuleBindings | undefined> {
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
      return undefined;
    }

    // Lazily registered on first actual import, exactly once per evaluator
    // instance — see PyPvmlEvaluatorBase's identical loadImports comment for
    // why the static ModuleLoaderRunnerPlugin.instance is deliberately not
    // used instead.
    this.moduleLoader ??= this.conductor.registerPlugin(
      ModuleLoaderRunnerPlugin,
      this.conductor,
      asInterfacableEvaluator(this, this.dataHandler),
    );
    const loader = this.moduleLoader;

    const entries: { name: string; value: TypedValue<DataType> }[] = [];
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
          entries.push({ name: spec.alias ?? spec.name, value: entry.value });
        }
      }),
    );
    return prepareModuleBindings(this.dataHandler, entries);
  }

  async evaluateChunk(chunk: string): Promise<void> {
    try {
      const source = chunk.endsWith("\n") ? chunk : chunk + "\n";
      const ast = parse(source);
      const moduleBindings = await this.loadImports(ast);
      const { errors, prints, renderedResult } = await compileToWasmAndRun(chunk, true, {
        chapter: this.chapter,
        groups: this.groups,
        moduleBindings,
      });

      if (errors.length > 0) {
        errors.forEach(error => this.conductor.sendError(new EvaluatorError(error)));
        return;
      }

      prints.forEach(print => this.conductor.sendOutput(print));
      if (renderedResult != null) {
        this.conductor.sendOutput(renderedResult);
      }
    } catch (error) {
      this.conductor.sendError(new EvaluatorError(error));
    }
  }

  async evaluateFile(fileName: string, fileContent: string): Promise<void> {
    try {
      const source = fileContent.endsWith("\n") ? fileContent : fileContent + "\n";
      const ast = parse(source);
      const moduleBindings = await this.loadImports(ast);
      const { errors, prints } = await compileToWasmAndRun(fileContent, false, {
        chapter: this.chapter,
        groups: this.groups,
        moduleBindings,
      });

      if (errors.length > 0) {
        errors.forEach(error => this.conductor.sendError(new EvaluatorError(error)));
        return;
      }

      prints.forEach(print => this.conductor.sendOutput(print));
    } catch (error) {
      this.conductor.sendError(new EvaluatorError(error));
    }
  }
}

export class PyWasmEvaluator1 extends PyWasmEvaluator {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 1, []);
  }
}

export class PyWasmEvaluator2 extends PyWasmEvaluator {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 2, [linkedList]);
  }
}

export class PyWasmEvaluator3 extends PyWasmEvaluator {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 3, [linkedList, pairmutator, list]);
  }
}

export class PyWasmEvaluator4 extends PyWasmEvaluator {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 4, [linkedList, pairmutator, list, mce]);
  }
}
