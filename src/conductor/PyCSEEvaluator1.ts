// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { initialise, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import PyCSEEvaluator from "./PyCSEEvaluator";

export default class PyCSEEvaluator1 extends PyCSEEvaluator {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, {}, 1, []);
  }
}
initialise(PyCSEEvaluator1);
