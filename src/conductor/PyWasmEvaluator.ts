// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { BasicEvaluator, initialise, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { compileToWasmAndRun } from "../wasm-compiler";

class PyWasmEvaluator extends BasicEvaluator {
  constructor(conductor: IRunnerPlugin) {
    super(conductor);
  }

  async evaluateChunk(chunk: string): Promise<void> {
    try {
      const { prints, renderedResult } = await compileToWasmAndRun(chunk, true);
      prints.forEach(print => this.conductor.sendOutput(print));
      this.conductor.sendResult(renderedResult); // find a way to send NOT stringified result
    } catch (error) {
      this.conductor.sendOutput(`Error: ${error instanceof Error ? error.message : error}`);
    }
  }

  async evaluateFile(fileName: string, fileContent: string): Promise<void> {
    try {
      const { prints } = await compileToWasmAndRun(fileContent);
      prints.forEach(print => this.conductor.sendOutput(print));
    } catch (error) {
      this.conductor.sendOutput(`Error: ${error instanceof Error ? error.message : error}`);
    }
  }
}

initialise(PyWasmEvaluator);
