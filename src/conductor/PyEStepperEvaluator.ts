import { E_STEPPER_DIRECTORY_ID } from "@sourceacademy/common-e-stepper";
import { ConductorError, EvaluatorSyntaxError } from "@sourceacademy/conductor/common";
import { BasicEvaluator, type IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { RunnerStatus } from "@sourceacademy/conductor/types";

import { parse } from "../parser";
import { checkEStepperProgram, EStepperProgramError } from "./estepper/getSteps";
import { PyEStepperRunnerPlugin } from "./estepper/PyEStepperRunnerPlugin";
import { registerAutoCompletePlugin } from "./plugins/autocomplete";
import { fetchRunConfig } from "./runConfig";

/**
 * A Conductor evaluator for Python §3/§4 that drives the environment stepper ("e-stepper"): it
 * registers the {@link PyEStepperRunnerPlugin}, asks the host to load the e-stepper's web plugin,
 * and on each run checks the program (as the CSE evaluator does) and pushes its steps to the host.
 *
 * Like the substitution stepper's evaluator, a run produces no REPL value and the program's output
 * is shown with the steps, not echoed to the REPL. Module imports are not supported yet.
 */
abstract class PyEStepperEvaluatorBase extends BasicEvaluator {
  private readonly eStepper: PyEStepperRunnerPlugin;

  protected constructor(
    conductor: IRunnerPlugin,
    private readonly chapter: number,
  ) {
    super(conductor);
    registerAutoCompletePlugin(conductor, chapter);
    this.eStepper = conductor.registerPlugin(PyEStepperRunnerPlugin, chapter);
    conductor.hostLoadPlugin(E_STEPPER_DIRECTORY_ID);
  }

  /** One-shot run, with the same status protocol as the substitution stepper's evaluator. */
  override async startEvaluator(entryPoint: string): Promise<void> {
    const code = await this.conductor.requestFile(entryPoint);
    if (code === undefined) {
      this.conductor.sendError(new ConductorError("Cannot load entrypoint file"));
      return;
    }
    await this.runChunk(code);
    this.conductor.updateStatus(RunnerStatus.STOPPED, true);
  }

  private async runChunk(chunk: string): Promise<void> {
    this.conductor.updateStatus(RunnerStatus.RUNNING, true);
    try {
      const script = chunk + "\n";
      const ast = parse(script);
      const config = await fetchRunConfig(this.conductor);
      if (config.stepLimit !== undefined) this.eStepper.setStepLimit(config.stepLimit);
      try {
        await checkEStepperProgram(ast, script, this.chapter);
      } catch (error) {
        if (error instanceof EStepperProgramError) throw new EvaluatorSyntaxError(error.message);
        throw error;
      }
      this.eStepper.setSource(script);
      await this.eStepper.sendSteps(ast);
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

  async evaluateChunk(chunk: string): Promise<void> {
    await this.runChunk(chunk);
  }
}

export class PyEStepperEvaluator3 extends PyEStepperEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 3);
  }
}

export class PyEStepperEvaluator4 extends PyEStepperEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 4);
  }
}
