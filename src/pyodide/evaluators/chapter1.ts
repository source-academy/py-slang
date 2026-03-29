import { initialise, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { ChapterPyodideEvaluator } from "../PyodideEvaluator";

class PyodideEvaluator1 extends ChapterPyodideEvaluator {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 1);
  }
}

initialise(PyodideEvaluator1);
