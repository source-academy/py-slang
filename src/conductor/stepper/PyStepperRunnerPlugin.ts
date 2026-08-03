import type {
  SerializedStepperStep,
  StepperMessage,
  SyntaxProfile,
} from "@sourceacademy/common-stepper";
import type { IChannel, IConduit } from "@sourceacademy/conductor/conduit";
import type { IDataHandler } from "@sourceacademy/conductor/types";
import { BaseStepperRunnerPlugin } from "@sourceacademy/runner-stepper";

import type { StmtNS } from "../../ast-types";
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
 * `evaluator` (a conductor `IDataHandler`, e.g. `PyStepperEvaluatorBase`'s own `GenericDataHandler`)
 * is what `getPythonSteps` uses to resolve a program's `FromImport`s, if any — see
 * `moduleInterop.ts`'s `resolveImports`. `undefined` when no module loader is wired up.
 */
export class PythonStepperRunnerPlugin extends BaseStepperRunnerPlugin<StmtNS.FileInput> {
  private readonly evaluator: IDataHandler | undefined;
  private readonly stepLimit: number;

  constructor(
    conduit: IConduit,
    channels: IChannel<StepperMessage>[],
    evaluator?: IDataHandler,
    stepLimit: number = DEFAULT_STEP_LIMIT,
  ) {
    super(conduit, channels);
    this.evaluator = evaluator;
    this.stepLimit = stepLimit;
  }

  getSteps(ast: StmtNS.FileInput): Promise<SerializedStepperStep[]> {
    return getPythonSteps(ast, this.stepLimit, this.evaluator);
  }

  /** Ships Python's rendering rules so the host displays Python syntax with no per-language host code. */
  protected override getSyntaxProfile(): SyntaxProfile {
    return pythonSyntaxProfile;
  }
}
