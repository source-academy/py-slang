// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { initialise, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import PyCSEEvaluator from "./PyCSEEvaluator";
import linkedList from "../stdlib/linked-list";

export default class PyCSEEvaluator2 extends PyCSEEvaluator {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, {}, 2, [linkedList]);
  }
}
initialise(PyCSEEvaluator2);
