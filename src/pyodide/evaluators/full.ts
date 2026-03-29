import { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import PyodideEvaluator from "../PyodideEvaluator";

export default class PyodideEvaluatorFull extends PyodideEvaluator {
  constructor(conductor: IRunnerPlugin) {
    super(conductor);
  }

  protected validateChunk(_chunk: string): void {}
}
