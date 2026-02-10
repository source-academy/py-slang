// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { BasicEvaluator, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { compileToWasmAndRun } from "../wasm-compiler/compile";

export default class PyEvaluator extends BasicEvaluator {
  constructor(conductor: IRunnerPlugin) {
    super(conductor);
  }

  async evaluateChunk(chunk: string): Promise<void> {
    try {
      const result = await compileToWasmAndRun(chunk);
      this.conductor.sendOutput(result);
    } catch (error) {
      this.conductor.sendOutput(
        `Error: ${error instanceof Error ? error.message : error}`
      );
    }
  }
}
