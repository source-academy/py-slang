import type { EStepperStep } from "@sourceacademy/common-e-stepper";
import type { StepperMessage, SyntaxProfile } from "@sourceacademy/common-stepper";
import type { IChannel, IConduit } from "@sourceacademy/conductor/conduit";
import { BaseEStepperRunnerPlugin } from "@sourceacademy/runner-e-stepper";

import type { StmtNS } from "../../ast-types";
import { DEFAULT_STEP_LIMIT, getEStepperSteps } from "./getSteps";
import { eStepperSyntaxProfile } from "./syntaxProfile";

/**
 * The py-slang (Python) binding of the language-agnostic e-stepper runner: produces the environment
 * stepper's steps for a parsed Python program. The evaluator sets the program's source text (which
 * the CSE machine's error messages quote) before each `sendSteps`.
 */
export class PyEStepperRunnerPlugin extends BaseEStepperRunnerPlugin<StmtNS.FileInput> {
  private code = "";
  private stepLimit = DEFAULT_STEP_LIMIT;

  constructor(
    conduit: IConduit,
    // The base class is the stepper's runner base: its channel carries the stepper's message type,
    // which has the same shape as the e-stepper's.
    channels: IChannel<StepperMessage>[],
    private readonly chapter: number,
  ) {
    super(conduit, channels);
  }

  setSource(code: string): void {
    this.code = code;
  }

  setStepLimit(stepLimit: number): void {
    this.stepLimit = stepLimit;
  }

  getSteps(ast: StmtNS.FileInput): Promise<EStepperStep[]> {
    return getEStepperSteps(ast, this.code, this.chapter, this.stepLimit);
  }

  protected override getSyntaxProfile(): SyntaxProfile {
    return eStepperSyntaxProfile;
  }
}
