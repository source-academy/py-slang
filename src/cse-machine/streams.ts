import { ConductorError } from "@sourceacademy/conductor/common";
import { IRunnerPlugin } from "@sourceacademy/conductor/runner";

export function createOutputStream(conductor: IRunnerPlugin): WritableStream<string> {
  return new WritableStream<string>({
    write: chunk => {
      conductor.sendOutput(chunk);
    },
  });
}

export function createErrorStream(conductor: IRunnerPlugin): WritableStream<ConductorError> {
  return new WritableStream<ConductorError>({
    write: chunk => {
      conductor.sendError(chunk);
    },
  });
}

export const createInputStream = (conductor: IRunnerPlugin): ReadableStream<string> => {
  return new ReadableStream<string>({
    async pull(controller) {
      const input = await conductor.requestInput();
      controller.enqueue(input);
      controller.close();
    },
  });
};
