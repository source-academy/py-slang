// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { initialise, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import PyCSEEvaluator from "./PyCSEEvaluator";
import linkedList from "../stdlib/linked-list";
import list from "../stdlib/list";
import pairmutator from "../stdlib/pairmutator";
import stream from "../stdlib/stream";

export default class PyCSEEvaluator3 extends PyCSEEvaluator {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, {}, 3, [linkedList, list, pairmutator, stream]);
  }
}
initialise(PyCSEEvaluator3);
