import { Context } from "../engines/cse/context";
import { InputStreamContext } from "../engines/cse/streams";
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
