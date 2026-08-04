import type {
  SerializedStepperStep,
  StepperMessage,
  SyntaxProfile,
} from "@sourceacademy/common-stepper";
import type { IChannel, IConduit } from "@sourceacademy/conductor/conduit";
import { BaseStepperRunnerPlugin } from "@sourceacademy/runner-stepper";

import type { StmtNS } from "../../ast-types";
import type { StepperContext } from "./context";
import { getPythonSteps } from "./getSteps";
import { pythonSyntaxProfile } from "./syntaxProfile";

const DEFAULT_STEP_LIMIT = 1000;

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
 * records real answers — see `InputRecorder`) and passes it in at registration.
 */
export class PythonStepperRunnerPlugin extends BaseStepperRunnerPlugin<StmtNS.FileInput> {
  private readonly context: StepperContext;
  /** Public so `PyStepperEvaluatorBase.runChunk` can pass the exact same value to its own separate
   * `evaluatePython` call — see that function's `stepLimit` doc comment for why the two passes must
   * agree, not just default to the same number. */
  readonly stepLimit: number;

  constructor(
    conduit: IConduit,
    channels: IChannel<StepperMessage>[],
    context: StepperContext = {},
    stepLimit: number = DEFAULT_STEP_LIMIT,
  ) {
    super(conduit, channels);
    this.context = context;
    this.stepLimit = stepLimit;
  }

  getSteps(ast: StmtNS.FileInput): Promise<SerializedStepperStep[]> {
    return getPythonSteps(ast, this.stepLimit, this.context);
  }

  /** Ships Python's rendering rules so the host displays Python syntax with no per-language host code. */
  protected override getSyntaxProfile(): SyntaxProfile {
    return pythonSyntaxProfile;
  }
}
