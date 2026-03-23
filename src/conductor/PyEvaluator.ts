// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { ErrorType } from "@sourceacademy/conductor/common";
import { BasicEvaluator, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { Context } from "../cse-machine/context";
import { createErrorStream, createInputStream, createOutputStream } from "../cse-machine/streams";
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
      const name = error instanceof Error ? error.name : "Error";
      const msg = error instanceof Error ? error.message : String(error);
      if (this.context.streams.initialised) {
        const writer = this.context.streams.stderr.getWriter();
        writer.write({ name: name, message: msg, errorType: ErrorType.EVALUATOR_SYNTAX });
        writer.releaseLock();
      }
    }
  }
}
