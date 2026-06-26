import { STEPPER_DIRECTORY_ID } from '@sourceacademy/common-stepper';
import { ConductorError, EvaluatorSyntaxError } from '@sourceacademy/conductor/common';
import { BasicEvaluator, type IRunnerPlugin } from '@sourceacademy/conductor/runner';
import { RunnerStatus } from '@sourceacademy/conductor/types';

import { parse } from '../parser';
import { evaluatePython } from './stepper/getSteps';
import { preprocessPython } from './stepper/preprocess';
import { PythonStepperRunnerPlugin } from './stepper/PyStepperRunnerPlugin';

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
 */
abstract class PyStepperEvaluatorBase extends BasicEvaluator {
  private readonly stepper: PythonStepperRunnerPlugin;

  protected constructor(conductor: IRunnerPlugin) {
    super(conductor);
    // Register the language-agnostic stepper runner (Python binding) and load its host (web) half.
    this.stepper = conductor.registerPlugin(PythonStepperRunnerPlugin);
    conductor.hostLoadPlugin(STEPPER_DIRECTORY_ID);
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
      this.conductor.sendError(new ConductorError('Cannot load entrypoint file'));
    } else {
      await this.runChunk(code);
    }
    // Signal that this run has finished so the host stops waiting and cleans up.
    this.conductor.updateStatus(RunnerStatus.STOPPED, true);
  }

  private async runChunk(chunk: string): Promise<void> {
    this.conductor.updateStatus(RunnerStatus.RUNNING, true);
    try {
      const script = chunk + '\n';
      const ast = parse(script);

      // Preprocessing: reject an undefined variable as a (preprocessing) error and do NOT run the
      // stepper — a free name has no meaning in the substitution model. Mirrors Source's
      // `checkProgramForUndefinedVariables`, which likewise blocks stepping rather than faulting
      // mid-reduction. `parse` already covers syntax errors above; this covers name resolution.
      const preprocessError = preprocessPython(ast);
      if (preprocessError !== null) {
        throw new EvaluatorSyntaxError(preprocessError);
      }

      // Push evaluation steps to the host for the Stepper tab.
      await this.stepper.sendSteps(ast);

      // Reduce to the final value for the REPL. We send a string (never `undefined`) so the result
      // survives the channel and does not break the host's result saga.
      this.conductor.sendResult(evaluatePython(ast));
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

export class PyStepperEvaluator1 extends PyStepperEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor);
  }
}
