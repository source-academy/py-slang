import { ConductorError, ErrorType } from "@sourceacademy/conductor/common";
import { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { Context } from "./context";
import { ErrorValue } from "./stash";

export type WritableContext<T> = {
  stream: WritableStream<T>;
  writer: WritableStreamDefaultWriter<T>;
};

export type ReadableContext<T> = {
  stream: ReadableStream<T>;
  reader: ReadableStreamDefaultReader<T>;
};

export function createOutputStream(conductor: IRunnerPlugin): WritableContext<string> {
  const stream = new WritableStream<string>({
    write: chunk => {
      conductor.sendOutput(chunk);
    },
  });
  const writer = stream.getWriter();
  return { stream, writer };
}

export function createErrorStream(conductor: IRunnerPlugin): WritableContext<ConductorError> {
  const stream = new WritableStream<ConductorError>({
    write: chunk => {
      conductor.sendError(chunk);
    },
  });

  const writer = stream.getWriter();
  return { stream, writer };
}

export const createInputStream = (conductor: IRunnerPlugin): ReadableContext<string> => {
  const stream = new ReadableStream<string>({
    async pull(controller) {
      const input = await conductor.requestInput();
      controller.enqueue(input);
    },
  });
  const reader = stream.getReader();
  return { stream, reader };
};

export const displayError = async (
  context: Context,
  error: unknown,
  type: ErrorType,
): Promise<ErrorValue> => {
  const name =
    typeof error === "object" && error !== null && "name" in error && typeof error.name === "string"
      ? error.name
      : "Error";
  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message
      : String(error);
  if (context.streams.initialised) {
    await context.streams.stderr.writer.write({ name, message, errorType: type });
  }
  return { type: "error", message: message };
};

export const displayOutput = async (context: Context, output: string) => {
  if (context.streams.initialised) {
    await context.streams.stdout.writer.write(output);
  }
};

export const receiveInput = async (context: Context): Promise<string> => {
  if (context.streams.initialised) {
    const reader = context.streams.stdin.reader;
    const { value } = await reader.read();
    return value ?? "";
  }
  return "";
};

export const destroyStreams = async (context: Context) => {
  if (context.streams.initialised) {
    context.streams.stdout.writer.releaseLock();
    context.streams.stderr.writer.releaseLock();
    context.streams.stdin.reader.releaseLock();

    await Promise.allSettled([
      context.streams.stdout.stream.close(),
      context.streams.stderr.stream.close(),
      context.streams.stdin.stream.cancel(),
    ]);
  }
  context.streams = { initialised: false };
};
