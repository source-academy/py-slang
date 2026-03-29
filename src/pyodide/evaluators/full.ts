import { initialise, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import PyodideEvaluator from "../PyodideEvaluator";

class PyodideEvaluatorFull extends PyodideEvaluator {
  constructor(conductor: IRunnerPlugin) {
    super(conductor);
  }

  protected validateChunk(_chunk: string): void {}
}

initialise(PyodideEvaluatorFull);
