import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { LazyChecker, type ChunkChecker } from "../typecheck";
import { PyEStepperEvaluatorBase } from "./PyEStepperEvaluator";
import { typedBeforeValidation } from "./typed";

/**
 * Typed Python §4 in the environment stepper: each program is checked (see TypedPy2JsEvaluator.ts for
 * what that is), and its steps, with its types erased, are those of a program of Python §4. A program
 * with type errors has no steps: each error is shown, with its line.
 */
export abstract class TypedPyEStepperEvaluatorBase extends PyEStepperEvaluatorBase {
  protected constructor(conductor: IRunnerPlugin, checker: ChunkChecker) {
    super(conductor, 4, typedBeforeValidation(checker));
  }
}

export class TypedPyEStepperEvaluator4 extends TypedPyEStepperEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    const checker = new LazyChecker();
    super(conductor, checker);
    checker.preload();
  }
}
