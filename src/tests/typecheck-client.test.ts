import { PyrightClient } from "../typecheck";
import { ensureTypedPython4Checker } from "../typecheck/bundler/typed4";
import { nodeWorkerFactory } from "../typecheck/node-worker";
import { CHECKER_SETUP_TIMEOUT_MS } from "./typecheck-harness";

describe("the client of the language server", () => {
  let client: PyrightClient;
  beforeAll(async () => {
    client = await PyrightClient.start(nodeWorkerFactory(await ensureTypedPython4Checker()));
  }, CHECKER_SETUP_TIMEOUT_MS);
  afterAll(() => client.dispose());

  test("files that are checked at the same time are checked one after the other, each with its own answer", async () => {
    const [ok, bad, ok2, bad2] = await Promise.all([
      client.check("a.py", "x: int = 1\n"),
      client.check("b.py", 'y: int = "a"\n'),
      client.check("a.py", "x: int = 2\n"),
      client.check("b.py", 'y: int = "b"\n'),
    ]);
    expect(ok).toEqual([]);
    expect(ok2).toEqual([]);
    expect(bad.map(d => d.message.split("\n")[0])).toEqual([
      'Type "Literal[\'a\']" is not assignable to declared type "int"',
    ]);
    expect(bad2).toHaveLength(1);
  });

  test("one file after another version of it: the answer is for the latest text", async () => {
    expect(await client.check("c.py", 'z: int = "a"\n')).toHaveLength(1);
    expect(await client.check("c.py", "z: int = 1\n")).toEqual([]);
    expect(await client.check("c.py", 'z: int = "a"\n')).toHaveLength(1);
  });

  test("a check that takes too long is an error, and the next check works", async () => {
    await expect(client.check("d.py", "x = 1\n", 0)).rejects.toThrow(/did not answer within 0 ms/);
    expect(await client.check("d.py", "x = 1\n")).toEqual([]);
  });

  test("a disposed client does not check", async () => {
    const other = await PyrightClient.start(nodeWorkerFactory(await ensureTypedPython4Checker()));
    other.dispose();
    await expect(other.check("e.py", "x = 1\n")).rejects.toThrow(/disposed/);
  });
});
