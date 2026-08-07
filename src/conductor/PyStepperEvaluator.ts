import { STEPPER_DIRECTORY_ID } from "@sourceacademy/common-stepper";
import { ConductorError, EvaluatorSyntaxError } from "@sourceacademy/conductor/common";
import { BasicEvaluator, type IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { RunnerStatus } from "@sourceacademy/conductor/types";
import { ModuleLoaderRunnerPlugin } from "@sourceacademy/runner-module-loader";

import { markBreakpoints } from "../breakpoints";
import { parse } from "../parser";
import { asInterfacableEvaluator, GenericDataHandler } from "./GenericDataHandler";
import { registerAutoCompletePlugin } from "./plugins/autocomplete";
import { fetchRunConfig } from "./runConfig";
import { preprocessPython } from "./stepper/preprocess";
import { PythonStepperRunnerPlugin } from "./stepper/PyStepperRunnerPlugin";

/**
 * A Conductor evaluator for Python that drives the stepper.
 *
 * On construction it registers the {@link PythonStepperRunnerPlugin} (so steps can be produced) and
 * asks the host to load the stepper's web plugin. Each run parses the program, pushes the evaluation
 * steps to the host (for the Stepper tab), and emits the status updates the host needs to stop the
 * run spinner and finish the run.
 *
 * `sendResult` is always called with `undefined`, exactly like `Py2JsEvaluator`/`PyodideEvaluator`'s
 * own exec-mode runs: a Python program run as a script never produces a value the way a REPL
 * expression does (py-slang#421) — the Stepper tab's own step sequence already shows the program's
 * final state, so there is nothing further to echo to the host's REPL. This evaluator used to
 * separately re-derive and send the text of the program's *last expression statement*, mirroring
 * js-slang's `SourceStepperEvaluator` — appropriate there, since Source is expression-oriented and a
 * program's last expression's value genuinely is "the result", but not for Python's exec model, where
 * no other evaluator here treats a script's tail expression as a value to report; the "3" that string
 * produced also outlived the Stepper tab itself, showing up as a stale REPL result even after
 * switching to a different evaluator without re-running anything.
 *
 * Module loading (`from X import y`, py-slang#385): a `GenericDataHandler` — the same engine-agnostic
 * `IDataHandler` implementation `PyCseEvaluatorBase`/`Py2JsEvaluatorBase` use — is registered with
 * `ModuleLoaderRunnerPlugin` exactly as those evaluators do, so `ModuleLoaderRunnerPlugin.instance` is
 * reachable from the stepper module for resolving a program's imports before stepping begins.
 *
 * `input()` (py-slang#191) round-trips through `this.conductor.requestInput`, the same real host
 * capability the CSE machine and py2js already use — a single, genuine round-trip per call, since
 * `sendSteps` below is now the program's only run (no second pass to keep answers consistent with,
 * unlike before py-slang#421's fix).
 */
abstract class PyStepperEvaluatorBase extends BasicEvaluator {
  private readonly stepper: PythonStepperRunnerPlugin;
  private readonly dataHandler: GenericDataHandler;
  /** The selected SICPy sublanguage (1–4). Gates which built-ins preprocessing accepts, so e.g. a
   * §1 program cannot use the §2 list library — see {@link preprocessPython}. */
  private readonly chapter: number;

  protected constructor(conductor: IRunnerPlugin, chapter: number) {
    super(conductor);
    registerAutoCompletePlugin(conductor, chapter);
    this.chapter = chapter;
    this.dataHandler = new GenericDataHandler(chapter);
    // Register the language-agnostic stepper runner (Python binding) and load its host (web) half.
    this.stepper = conductor.registerPlugin(PythonStepperRunnerPlugin, {
      evaluator: this.dataHandler,
      requestInput: prompt => this.conductor.requestInput(prompt),
    });
    conductor.hostLoadPlugin(STEPPER_DIRECTORY_ID);
    this.conductor.registerPlugin(
      ModuleLoaderRunnerPlugin,
      this.conductor,
      asInterfacableEvaluator(this, this.dataHandler),
    );
  }

  /**
   * One-shot run: evaluate the entrypoint, then report completion. We override `startEvaluator`
   * (rather than only implementing `evaluateChunk`) so that:
   *  - we emit RUNNING true/false status updates (the host clears the run spinner on RUNNING=false),
   *  - we emit a terminal STOPPED status so the host's evaluation loop completes and tears down, and
   *  - we never let the base class send an `undefined` result (which crashes the host saga channel).
   */
  override async startEvaluator(entryPoint: string): Promise<void> {
    const code = await this.conductor.requestFile(entryPoint);
    if (code === undefined) {
      this.conductor.sendError(new ConductorError("Cannot load entrypoint file"));
      return;
    } else {
      await this.runChunk(code);
    }
    // Signal that this run has finished so the host stops waiting and cleans up.
    this.conductor.updateStatus(RunnerStatus.STOPPED, true);
  }

  private async runChunk(chunk: string): Promise<void> {
    this.conductor.updateStatus(RunnerStatus.RUNNING, true);
    try {
      const script = chunk + "\n";
      this.dataHandler.setCurrentSource(script);
      const ast = parse(script);

      const config = await fetchRunConfig(this.conductor);
      markBreakpoints(ast, config.breakpointLines ?? []);

      // Preprocessing: reject an undefined variable as a (preprocessing) error and do NOT run the
      // stepper — a free name has no meaning in the substitution model. Mirrors Source's
      // `checkProgramForUndefinedVariables`, which likewise blocks stepping rather than faulting
      // mid-reduction. `parse` already covers syntax errors above; this covers name resolution.
      const preprocessError = preprocessPython(ast, script, this.chapter);
      if (preprocessError !== null) {
        throw new EvaluatorSyntaxError(preprocessError);
      }

      // Push evaluation steps to the host for the Stepper tab — this program's one and only run.
      await this.stepper.sendSteps(ast);

      // A Python script has no REPL value to report (py-slang#421) — see the class doc comment.
      this.conductor.sendResult(undefined);
    } catch (error) {
      this.conductor.sendError(
        error instanceof SyntaxError
          ? new EvaluatorSyntaxError(error.message)
          : error instanceof ConductorError
            ? error
            : new ConductorError(error instanceof Error ? error.message : String(error)),
      );
    } finally {
      this.conductor.updateStatus(RunnerStatus.RUNNING, false);
    }
  }

  // Required by BasicEvaluator. Not used directly (startEvaluator is overridden), but kept correct.
  async evaluateChunk(chunk: string): Promise<void> {
    await this.runChunk(chunk);
  }
}

// One concrete evaluator per SICPy chapter, mirroring `PyCseEvaluator1..4`: the host loads
// `PyStepperEvaluator<chapter>` for the selected sublanguage (see `scripts/build.ts` / the conductor
// `index`). The chapter is what gates the built-ins preprocessing accepts, so the §1 stepper forbids
// the §2 list library (`pair`/`head`/`map`/…) while the §2 stepper allows it.
export class PyStepperEvaluator1 extends PyStepperEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 1);
  }
}

export class PyStepperEvaluator2 extends PyStepperEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 2);
  }
}
