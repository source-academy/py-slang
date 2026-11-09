import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { LazyChecker, type ChunkChecker } from "../typecheck";
import { CSE_GROUPS_4, PyCseEvaluatorBase } from "./PyCseEvaluator";
import { typedBeforeValidation } from "./typed";

/**
 * Python §4 Typed on the CSE machine: each chunk is checked (see TypedPy2JsEvaluator.ts for what
 * that is), and runs, with its types erased, as a chunk of Python §4 on the CSE machine, whose tab
 * shows its steps. A chunk with type errors is not run: each error is shown, with its line.
 */
export abstract class TypedPyCseEvaluatorBase extends PyCseEvaluatorBase {
  protected constructor(conductor: IRunnerPlugin, checker: ChunkChecker) {
    super(conductor, 4, CSE_GROUPS_4, typedBeforeValidation(checker));
  }
}

export class TypedPyCseEvaluator4 extends TypedPyCseEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    const checker = new LazyChecker();
    super(conductor, checker);
    checker.preload();
  }
}
