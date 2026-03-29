import { initialise, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { ChapterPyodideEvaluator } from "../PyodideEvaluator";

class PyodideEvaluator2 extends ChapterPyodideEvaluator {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 2);
  }
}

initialise(PyodideEvaluator2);
