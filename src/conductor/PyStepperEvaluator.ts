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
import { evaluatePython } from "./stepper/getSteps";
import { preprocessPython } from "./stepper/preprocess";
import { PythonStepperRunnerPlugin } from "./stepper/PyStepperRunnerPlugin";

/**
 * Records real `requestInput` answers as they're given during one pass over a program (always the
 * Stepper tab's own `sendSteps`, driven through {@link InputRecorder.recording} below), so a second,
 * *separate* pass over the identical program (`evaluatePython`'s own re-derivation of the REPL's
 * echoed value, in `runChunk`) can {@link InputRecorder.replaying} the same answers instead of
 * asking the student a second time for what is, from their perspective, the exact same `input()`
 * call — see py-slang#191. Both passes reduce the same AST from the same starting substitutions, so
 * the Nth `input()` call reached by either pass is always the Nth recorded answer.
 *
 * One instance survives across every `runChunk` call over `PyStepperEvaluatorBase`'s lifetime (the
 * same way `PyCseEvaluatorBase`'s own `this.context` does — see its doc comment), so {@link reset}
 * must run at the start of each `runChunk`, before `sendSteps`, or a run would replay a *previous*
 * run's leftover answers.
 */
class InputRecorder {
  private log: string[] = [];
  private replayIndex = 0;

  constructor(private readonly real: (prompt?: string) => Promise<string>) {}

  /** Clears the log — call once per `runChunk`, before the recording pass. */
  reset(): void {
    this.log = [];
    this.replayIndex = 0;
  }

  /** The real, host-round-tripping requester. Wire this into whichever pass runs first. */
  recording = async (prompt?: string): Promise<string> => {
    const answer = await this.real(prompt);
    this.log.push(answer);
    return answer;
  };

  /** Consumes the recorded log in order. Wire this into any later pass re-deriving the same run.
   * Falls back to a real request past the end of the log (the two passes took different paths —
   * shouldn't happen given they reduce the same AST, but a real answer beats fabricating a wrong
   * one). */
  replaying = async (prompt?: string): Promise<string> => {
    if (this.replayIndex < this.log.length) return this.log[this.replayIndex++];
    return this.recording(prompt);
  };
}

/**
 * A Conductor evaluator for Python that drives the stepper.
 *
 * On construction it registers the {@link PythonStepperRunnerPlugin} (so steps can be produced) and
 * asks the host to load the stepper's web plugin. Each run parses the program, pushes the evaluation
 * steps to the host (for the Stepper tab), reduces the program to its final value for the REPL, and
 * emits the status updates the host needs to stop the run spinner and finish the run.
 *
 * This mirrors js-slang's `SourceStepperEvaluator`; only parsing and step production are
 * Python-specific.
 *
 * Module loading (`from X import y`, py-slang#385): a `GenericDataHandler` — the same engine-agnostic
 * `IDataHandler` implementation `PyCseEvaluatorBase`/`Py2JsEvaluatorBase` use — is registered with
 * `ModuleLoaderRunnerPlugin` exactly as those evaluators do, so `ModuleLoaderRunnerPlugin.instance` is
 * reachable from the stepper module for resolving a program's imports before stepping begins.
 *
 * `input()` (py-slang#191) round-trips through `this.conductor.requestInput`, the same real host
 * capability the CSE machine and py2js already use, via an {@link InputRecorder} — see its own doc
 * comment for why a *recording* requester goes to the Stepper tab's pass and a *replaying* one to the
 * REPL-value pass, not the real thing twice.
 *
 * Both capabilities are bundled into one `StepperContext` (see `context.ts`) handed to
 * `PythonStepperRunnerPlugin` at registration below, which threads it into `getPythonSteps` for the
 * Stepper tab's steps; `runChunk` builds a second one (same `evaluator`, replaying `requestInput`) for
 * `evaluatePython`'s separate REPL-value pass.
 */
abstract class PyStepperEvaluatorBase extends BasicEvaluator {
  private readonly stepper: PythonStepperRunnerPlugin;
  private readonly dataHandler = new GenericDataHandler();
  private readonly inputRecorder = new InputRecorder(prompt => this.conductor.requestInput(prompt));
  /** The selected SICPy sublanguage (1–4). Gates which built-ins preprocessing accepts, so e.g. a
   * §1 program cannot use the §2 list library — see {@link preprocessPython}. */
  private readonly chapter: number;

  protected constructor(conductor: IRunnerPlugin, chapter: number) {
    super(conductor);
    registerAutoCompletePlugin(conductor, chapter);
    this.chapter = chapter;
    // Register the language-agnostic stepper runner (Python binding) and load its host (web) half.
    this.stepper = conductor.registerPlugin(PythonStepperRunnerPlugin, {
      evaluator: this.dataHandler,
      requestInput: this.inputRecorder.recording,
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

      // Push evaluation steps to the host for the Stepper tab. Any `input()` call this pass reaches
      // triggers a real requestInput round-trip, recorded as it happens.
      this.inputRecorder.reset();
      await this.stepper.sendSteps(ast);

      // Reduce to the final value for the REPL. We send a string (never `undefined`) so the result
      // survives the channel and does not break the host's result saga. Replays whatever `input()`
      // answers the pass above already recorded — see `InputRecorder`'s doc comment — rather than
      // prompting the student a second time for the same input.
      this.conductor.sendResult(
        await evaluatePython(ast, {
          evaluator: this.dataHandler,
          requestInput: this.inputRecorder.replaying,
        }),
      );
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
