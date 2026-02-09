// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { runInContext, IOptions } from "../runner/pyRunner";
import { Context } from "../cse-machine/context";
import { BasicEvaluator, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { Finished } from "../types";

const defaultContext = new Context();
const defaultOptions: IOptions = {
  isPrelude: false,
  envSteps: 100000,
  stepLimit: 100000,
};

export default class PyEvaluator extends BasicEvaluator {
  private context: Context;
  private options: IOptions;

  constructor(conductor: IRunnerPlugin) {
    super(conductor);
    this.context = defaultContext;
    this.options = defaultOptions;
  }

  async evaluateChunk(chunk: string): Promise<void> {
    try {
      const result = await runInContext(
        chunk, // Code
        this.context,
        this.options
      );
      this.conductor.sendOutput(
        `${(result as Finished).representation.toString(
          (result as Finished).value
        )}`
      );
    } catch (error) {
      this.conductor.sendOutput(
        `Error: ${error instanceof Error ? error.message : error}`
      );
    }
  }
}
