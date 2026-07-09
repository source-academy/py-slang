import { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { Context } from "../engines/cse/context";
import { createInputStream, InputStreamContext, receiveInput } from "../engines/cse/streams";
import { MiscBuiltins } from "../stdlib/misc";

function makeStreams(canned: string) {
  const outputs: string[] = [];
  const stdoutStream = new WritableStream<string>({
    write: chunk => {
      outputs.push(chunk);
    },
  });
  const stderrStream = new WritableStream<unknown>({ write: () => {} });

  const stdinStream = new ReadableStream<string>({
    pull(controller) {
      controller.enqueue(canned);
    },
  });
  const prompts: (string | undefined)[] = [];
  const stdin: InputStreamContext = {
    stream: stdinStream,
    reader: stdinStream.getReader(),
    setNextPrompt: prompt => prompts.push(prompt),
  };

  return {
    outputs,
    prompts,
    streams: {
      initialised: true as const,
      stdout: { stream: stdoutStream, writer: stdoutStream.getWriter() },
      stderr: { stream: stderrStream, writer: stderrStream.getWriter() },
      stdin,
    },
  };
}

describe("input()", () => {
  test("with a prompt: writes the prompt to stdout (no newline) and returns the typed value", async () => {
    const context = new Context();
    const { outputs, prompts, streams } = makeStreams("hello");
    context.streams = streams;

    const result = await MiscBuiltins.input(
      [{ type: "string", value: "Write your string here: " }],
      "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      context,
    );

    expect(result).toEqual({ type: "string", value: "hello" });
    expect(outputs.join("")).toBe("Write your string here: ");
    expect(prompts).toEqual(["Write your string here: "]);
  });

  test("with no prompt: writes nothing to stdout and returns the typed value", async () => {
    const context = new Context();
    const { outputs, prompts, streams } = makeStreams("42");
    context.streams = streams;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await MiscBuiltins.input([], "", {} as any, context);

    expect(result).toEqual({ type: "string", value: "42" });
    expect(outputs.join("")).toBe("");
    expect(prompts).toEqual([undefined]);
  });
});

// Regression coverage for the real createInputStream/receiveInput pairing (not the hand-rolled
// stdin used above) — a ReadableStream's default highWaterMark of 1 makes it eagerly pull() as
// soon as it's constructed, before any input() call has set a prompt. That would fire a phantom
// requestInput(undefined) and leave each real prompt to be used one call late.
describe("createInputStream (real ReadableStream, not a hand-rolled mock)", () => {
  function makeConductor(responses: string[]) {
    const requestedPrompts: (string | undefined)[] = [];
    let call = 0;
    const conductor = {
      requestInput: async (prompt?: string) => {
        requestedPrompts.push(prompt);
        return responses[call++];
      },
    } as unknown as IRunnerPlugin;
    return { conductor, requestedPrompts };
  }

  test("each receiveInput call gets its own prompt, in order, with no off-by-one", async () => {
    const { conductor, requestedPrompts } = makeConductor(["first answer", "second answer"]);
    const context = new Context();
    const stdoutStream = new WritableStream<string>();
    const stderrStream = new WritableStream<unknown>();
    context.streams = {
      initialised: true,
      stdout: { stream: stdoutStream, writer: stdoutStream.getWriter() },
      stderr: { stream: stderrStream, writer: stderrStream.getWriter() },
      stdin: createInputStream(conductor),
    };

    const first = await receiveInput(context, "prompt A");
    const second = await receiveInput(context, "prompt B");

    expect(first).toBe("first answer");
    expect(second).toBe("second answer");
    expect(requestedPrompts).toEqual(["prompt A", "prompt B"]);
  });
});
