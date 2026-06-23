import type { SerializedStepperStep, SyntaxProfile } from '@sourceacademy/common-stepper';
import type { IChannel, IConduit } from '@sourceacademy/conductor/conduit';
import { BaseStepperRunnerPlugin } from '@sourceacademy/runner-stepper';

import type { StmtNS } from '../../ast-types';
import { getPythonSteps } from './getSteps';
import { pythonSyntaxProfile } from './syntaxProfile';

const DEFAULT_STEP_LIMIT = 1000;

/**
 * The py-slang (Python) binding of the language-agnostic stepper runner.
 *
 * It receives a parsed Python program (`StmtNS.FileInput`) and produces serialized evaluation steps
 * by driving the Python substitution stepper ({@link getPythonSteps}). All Python-specific knowledge
 * lives in the stepper module; the base class and host plugin stay language-agnostic.
 */
export class PythonStepperRunnerPlugin extends BaseStepperRunnerPlugin<StmtNS.FileInput> {
  private readonly stepLimit: number;

  constructor(
    conduit: IConduit,
    channels: IChannel<any>[],
    stepLimit: number = DEFAULT_STEP_LIMIT,
  ) {
    super(conduit, channels);
    this.stepLimit = stepLimit;
  }

  getSteps(ast: StmtNS.FileInput): SerializedStepperStep[] {
    return getPythonSteps(ast, this.stepLimit);
  }

  /** Ships Python's rendering rules so the host displays Python syntax with no per-language host code. */
  protected override getSyntaxProfile(): SyntaxProfile {
    return pythonSyntaxProfile;
  }
}
