import type { EStepperStep } from "@sourceacademy/common-e-stepper";
import type { StepperMessage, SyntaxProfile, TraceEnd } from "@sourceacademy/common-stepper";
import type { IChannel, IConduit } from "@sourceacademy/conductor/conduit";
import { BaseEStepperRunnerPlugin } from "@sourceacademy/runner-e-stepper";
import type { StepBatches } from "@sourceacademy/runner-stepper";

import type { StmtNS } from "../../ast-types";
import { E_STEPPER_STEP_CAP } from "../runConfig";
import type { RequestInput } from "./engine";
import { getEStepperStepBatches, getEStepperSteps } from "./getSteps";
import { eStepperSyntaxProfile } from "./syntaxProfile";

/**
 * The py-slang (Python) binding of the language-agnostic e-stepper runner: produces the environment
 * stepper's steps for a parsed Python program. The evaluator sets the program's source text (which
 * the CSE machine's error messages quote) before each `sendSteps`.
 */
export class PyEStepperRunnerPlugin extends BaseEStepperRunnerPlugin<StmtNS.FileInput> {
  private code = "";
  private stepLimit = E_STEPPER_STEP_CAP;

  constructor(
    conduit: IConduit,
    // The base class is the stepper's runner base: its channel carries the stepper's message type,
    // which has the same shape as the e-stepper's.
    channels: IChannel<StepperMessage>[],
    private readonly chapter: number,
    /** How `input()` asks the user for a line (the evaluator passes the host's `requestInput`). */
    private readonly requestInput?: RequestInput,
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
    return getEStepperSteps(ast, this.code, this.chapter, this.stepLimit, this.requestInput);
  }

  /**
   * The steps in batches, as they are made, so that the host has the steps so far if the run is
   * stopped, or never finishes (the host stops a run by terminating the worker). The trace ends as
   * cut off, with the reason, if the step limit or the memory guard ended the run.
   */
  protected override getStepBatches(ast: StmtNS.FileInput): StepBatches {
    const { code, chapter, stepLimit, requestInput } = this;
    return (async function* (): AsyncGenerator<EStepperStep[], TraceEnd | undefined> {
      const end = yield* getEStepperStepBatches(ast, code, chapter, stepLimit, requestInput);
      if (!end.truncated) return undefined;
      return {
        status: "cut-off",
        reason:
          end.truncatedBy === "memory"
            ? "the steps use too much memory"
            : `the limit of ${stepLimit} steps was reached`,
      };
    })();
  }

  protected override getSyntaxProfile(): SyntaxProfile {
    return eStepperSyntaxProfile;
  }
}
