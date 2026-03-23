import { ConductorError, ErrorType } from "@sourceacademy/conductor/common";
import { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { Context } from "./context";

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

export const displayError = (context: Context, error: unknown, type: ErrorType) => {
  const name = typeof error === "object" && error !== null && "name" in error && typeof error.name === "string" ? error.name : "Error";
  const message = typeof error === "object" && error !== null && "message" in error && typeof error.message === "string" ? error.message : String(error);
  if (context.streams.initialised) {
    const writer = context.streams.stderr.getWriter();
    writer.write({ name, message, errorType: type });
    writer.releaseLock();
  }
}

export const displayOutput = (context: Context, output: string) => {
  if (context.streams.initialised) {
    const writer = context.streams.stdout.getWriter();
    writer.write(output);
    writer.releaseLock();
  }
}
