import { initialise, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { ChapterPyodideEvaluator } from "../PyodideEvaluator";

class PyodideEvaluator3 extends ChapterPyodideEvaluator {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 3);
  }
}

initialise(PyodideEvaluator3);
