// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { ErrorType } from "@sourceacademy/conductor/common";
import { BasicEvaluator, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { Context } from "../cse-machine/context";
import {
  createErrorStream,
  createInputStream,
  createOutputStream,
  displayError,
} from "../cse-machine/streams";
import { IOptions, runInContext } from "../runner/pyRunner";

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
      this.context.streams = {
        initialised: true,
        stdout: createOutputStream(this.conductor),
        stderr: createErrorStream(this.conductor),
        stdin: createInputStream(this.conductor),
      };
      await runInContext(
        chunk, // Code
        this.context,
        this.options,
      );
    } catch (error) {
      if (error instanceof SyntaxError) {
        return displayError(this.context, error, ErrorType.EVALUATOR_SYNTAX);
      }
      displayError(this.context, error, ErrorType.INTERNAL);
    }
  }
}
