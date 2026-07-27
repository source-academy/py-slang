import { createBufferedOutputStream } from "../engines/cse/streams";

describe("createBufferedOutputStream", () => {
  const makeMockConductor = () => {
    const calls: string[] = [];
    return {
      sendOutput: (msg: string) => calls.push(msg),
      calls,
    };
  };

  it("flushes all written chunks as a single sendOutput call", async () => {
    const { context, flush } = createBufferedOutputStream();
    await context.writer.write("hello ");
    await context.writer.write("world\n");
    const { sendOutput, calls } = makeMockConductor();
    flush({ sendOutput } as never);
    expect(calls).toEqual(["hello world\n"]);
  });

  it("does not call sendOutput when buffer is empty", () => {
    const { flush } = createBufferedOutputStream();
    const { sendOutput, calls } = makeMockConductor();
    flush({ sendOutput } as never);
    expect(calls).toHaveLength(0);
  });

  it("clears buffer after flush so double-flush never duplicates output", async () => {
    const { context, flush } = createBufferedOutputStream();
    await context.writer.write("line\n");
    const { sendOutput, calls } = makeMockConductor();
    flush({ sendOutput } as never);
    flush({ sendOutput } as never);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe("line\n");
  });
});
