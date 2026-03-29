import { initialise, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { ChapterPyodideEvaluator } from "../PyodideEvaluator";

class PyodideEvaluator4 extends ChapterPyodideEvaluator {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 4);
  }
}

initialise(PyodideEvaluator4);
