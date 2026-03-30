import { BasicEvaluator } from "@sourceacademy/conductor/runner";
import { compileToWasmAndRun } from "../engines/wasm";
import { toEvaluatorError } from "./errors";

export class PyWasmEvaluator extends BasicEvaluator {
  async evaluateChunk(chunk: string): Promise<void> {
    try {
      const result = await compileToWasmAndRun(chunk);
      if (result !== undefined && result !== null) {
        this.conductor.sendResult(result);
      }
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.conductor.sendError(toEvaluatorError(e) as any);
    }
  }
}
