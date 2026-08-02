import { BasicEvaluator, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { DATA_VISUALIZER_DIRECTORY_ID } from "@sourceacademy/common-data-visualizer";
import { ModuleLoaderRunnerPlugin } from "@sourceacademy/runner-module-loader";
import { Py2JsSession } from "../engines/py2js";
import { Py2JsDataVisualizerRunnerPlugin } from "./dataVisualizer/Py2JsDataVisualizerRunnerPlugin";
import { asInterfacableEvaluator, GenericDataHandler } from "./GenericDataHandler";
import { EvaluatorError } from "./errors";
import { registerAutoCompletePlugin } from "./plugins/autocomplete";

/**
 * Runs Python by compiling it to JavaScript — the py2js engine
 * (src/engines/py2js): native unboxed values, tail-call trampoline, the real
 * stdlib bridged at the value boundary, and operator semantics pinned
 * against the CSE machine by the table-driven conformance sweeps.
 *
 * Mirrors PyPvmlEvaluatorBase's persistence model: one Py2JsSession survives
 * across evaluateChunk() calls, holding the runtime and its module-level
 * globals table (REPL compile mode — see compiler.ts), so a later chunk sees
 * every name an earlier chunk defined, and functions from earlier chunks see
 * later redefinitions via late lookup, as with the CSE machine's global
 * environment. Group preludes (none at chapter 1) are compiled into the same
 * session by its first runChunk().
 *
 * Module loading (`from X import y`): the session is handed a
 * GenericDataHandler — the same engine-agnostic IDataHandler implementation
 * PyCseEvaluatorBase uses — and this evaluator registers
 * ModuleLoaderRunnerPlugin with that same instance, exactly mirroring
 * PyCseEvaluatorBase's own registration. A chunk that imports something is
 * loaded and converted (moduleInterop.ts) before it compiles, and compiles in
 * dual mode so its imported module functions are callable via the session's
 * async spine.
 *
 * Exec-style, like the PVML-in-browser evaluator: every chunk reports no
 * result value; a chunk that wants to surface a value print()s it. Output
 * streams per print() line through the session's onOutput hook. input()
 * round-trips through the session's requestInput hook (conductor.requestInput)
 * — a chunk that calls it, at any nesting depth, compiles in dual mode even
 * with no imports of its own (see Py2JsSession.runChunk's use of
 * Resolver.referencedNames).
 *
 * set_timeout(f, t) (source-academy/py-slang#311) schedules a real callback
 * that can fire well after evaluateChunk() itself has resolved — the
 * session's onPendingWorkChange hook is wired straight to BasicEvaluator's
 * own beginPendingWork()/endPendingWork(), so the host (e.g. Source
 * Academy's frontend) doesn't tear this evaluator's environment down while
 * one is still pending (source-academy/py-slang#329 is what happens without
 * this: the callback is silently killed mid-flight, unreliably, past
 * whatever grace window the host happens to allow after a chunk resolves).
 *
 * Chapters 1-4 (the engine rejects other variants).
 *
 * draw_data (chapter 2+, bridged natively as part of the LINKED_LISTS group — see
 * stdlibBridge.ts's nativeDrawData): registered only for §2+, exactly mirroring
 * PyCseEvaluatorBase's identical gate — draw_data doesn't exist as a builtin below that, so there's
 * no reason to register the plugin or have the host fetch its web bundle for §1 users.
 */
abstract class Py2JsEvaluatorBase extends BasicEvaluator {
  private readonly session: Py2JsSession;
  private readonly dataVisualizerPlugin?: Py2JsDataVisualizerRunnerPlugin;

  protected constructor(conductor: IRunnerPlugin, variant: number) {
    super(conductor);
    registerAutoCompletePlugin(conductor, variant);
    const dataHandler = new GenericDataHandler();
    this.conductor.registerPlugin(
      ModuleLoaderRunnerPlugin,
      this.conductor,
      asInterfacableEvaluator(this, dataHandler),
    );

    if (variant >= 2) {
      this.dataVisualizerPlugin = conductor.registerPlugin(Py2JsDataVisualizerRunnerPlugin);
      conductor.hostLoadPlugin(DATA_VISUALIZER_DIRECTORY_ID);
    }

    this.session = new Py2JsSession(variant, {
      onOutput: line => this.conductor.sendOutput(line),
      onPendingWorkChange: delta => (delta > 0 ? this.beginPendingWork() : this.endPendingWork()),
      requestInput: prompt => this.conductor.requestInput(prompt),
      // A local import (`from .foo import x`, source-academy/py-slang#378)
      // resolves a sibling file through this — conductor's own
      // requestFile(fileName), already backed by whatever multi-file store
      // the host has (e.g. the frontend's folder-mode BrowserFS), the same
      // primitive BasicEvaluator.startEvaluator already uses to fetch the
      // entrypoint itself. No new host-side protocol needed.
      fileGetter: path => this.conductor.requestFile(path),
      dataHandler,
      dataVisualizer: this.dataVisualizerPlugin,
    });
  }

  /**
   * The host's own entrypoint file name (e.g. "/main.py" in a folder-mode
   * program) — BasicEvaluator's default evaluateFile discards it, but a
   * local import needs to know what directory "." means, so this override
   * captures it on the session before delegating exactly as the default
   * implementation would.
   *
   * (`__program__` needs no help from here: Py2JsSession.runChunkInternal
   * sets it itself, automatically, from whatever text it's actually about
   * to compile — see that method's own comment. This evaluator used to
   * never supply it at all, which crashed every reference to `__program__`
   * with a raw ReferenceError rather than a Python-level NameError; fixed
   * at the source rather than by adding another external call here.)
   */
  async evaluateFile(fileName: string, fileContent: string): Promise<void> {
    this.session.setEntrypointFilePath(fileName);
    return this.evaluateChunk(fileContent);
  }

  async evaluateChunk(chunk: string): Promise<void> {
    try {
      await this.dataVisualizerPlugin?.resetRun();
      await this.session.runChunk(chunk);
      this.conductor.sendResult(undefined);
    } catch (e) {
      this.conductor.sendError(new EvaluatorError(e));
    }
  }
}

export class Py2JsEvaluator1 extends Py2JsEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 1);
  }
}

export class Py2JsEvaluator2 extends Py2JsEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 2);
  }
}

export class Py2JsEvaluator3 extends Py2JsEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 3);
  }
}

export class Py2JsEvaluator4 extends Py2JsEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 4);
  }
}
