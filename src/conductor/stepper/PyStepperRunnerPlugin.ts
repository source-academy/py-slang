import type {
  SerializedStepperStep,
  StepperMessage,
  SyntaxProfile,
  TraceEnd,
} from "@sourceacademy/common-stepper";
import type { IChannel, IConduit } from "@sourceacademy/conductor/conduit";
import { BaseStepperRunnerPlugin, type StepBatches } from "@sourceacademy/runner-stepper";

import type { StmtNS } from "../../ast-types";
import { STEPPER_STEP_CAP } from "../runConfig";
import type { StepperContext } from "./context";
import { getPythonStepBatches, getPythonSteps } from "./getSteps";
import { pythonSyntaxProfile } from "./syntaxProfile";

/**
 * The py-slang (Python) binding of the language-agnostic stepper runner.
 *
 * It receives a parsed Python program (`StmtNS.FileInput`) and produces serialized evaluation steps
 * by driving the Python substitution stepper ({@link getPythonSteps}). All Python-specific knowledge
 * lives in the stepper module; the base class and host plugin stay language-agnostic.
 *
 * `context` (see `context.ts`) is what `getPythonSteps` uses to resolve a program's `FromImport`s and
 * `input()` calls, if any — see `moduleInterop.ts`'s `resolveImports` and `reduce.ts`'s `contractCall`.
 * `PyStepperEvaluatorBase` builds it once (its own `GenericDataHandler`, plus a `requestInput` that
 * round-trips through the host for real) and passes it in at registration.
 */
export class PythonStepperRunnerPlugin extends BaseStepperRunnerPlugin<StmtNS.FileInput> {
  private readonly context: StepperContext;
  private stepLimit: number;

  constructor(
    conduit: IConduit,
    channels: IChannel<StepperMessage>[],
    context: StepperContext = {},
    stepLimit: number = STEPPER_STEP_CAP,
  ) {
    super(conduit, channels);
    this.context = context;
    this.stepLimit = stepLimit;
  }

  /** Overrides the step limit baked in at construction — used to apply the host-configured
   * `/__cse_config__` value (see `runConfig.ts`), which isn't known until the first run. */
  setStepLimit(stepLimit: number): void {
    this.stepLimit = stepLimit;
  }

  getSteps(ast: StmtNS.FileInput): Promise<SerializedStepperStep[]> {
    return getPythonSteps(ast, this.stepLimit, this.context);
  }

  /**
   * The steps in batches, as they are reduced, so that the host has the steps so far if the run is
   * stopped, or never finishes (the host stops a run by terminating the worker). The trace ends as
   * cut off, with the reason, if the step limit was reached.
   */
  protected override getStepBatches(ast: StmtNS.FileInput): StepBatches {
    const { stepLimit, context } = this;
    return (async function* (): AsyncGenerator<SerializedStepperStep[], TraceEnd | undefined> {
      const end = yield* getPythonStepBatches(ast, stepLimit, context);
      return end.limitReached
        ? { status: "cut-off", reason: `the limit of ${stepLimit} steps was reached` }
        : undefined;
    })();
  }

  /** Ships Python's rendering rules so the host displays Python syntax with no per-language host code. */
  protected override getSyntaxProfile(): SyntaxProfile {
    return pythonSyntaxProfile;
  }
}
