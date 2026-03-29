import { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { ChapterPyodideEvaluator } from "../PyodideEvaluator";

export default class PyodideEvaluator1 extends ChapterPyodideEvaluator {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 1);
  }
}
