import { runCodePy2Js } from "../engines/py2js";
import { runCodePvmlInterpreter } from "../pvml-runner";
import { runCode } from "../runner";

/** The headless runners (what the CLI uses). Each returns the program's printed output. */
const ENGINES: [string, (code: string, chapter: number) => Promise<string>][] = [
  ["cse", (code, chapter) => runCode(code, chapter)],
  ["py2js", (code, chapter) => Promise.resolve().then(() => runCodePy2Js(code, chapter).output)],
  ["pvml", (code, chapter) => runCodePvmlInterpreter(code, chapter)],
];

const lines = (output: string) => output.trimEnd().split("\n");

describe.each(ENGINES)("draw_data in the headless %s runner", (_name, run) => {
  describe.each([2, 3, 4])("chapter %i", chapter => {
    test("returns its first argument", async () => {
      expect(lines(await run("x = draw_data(5)\nprint(x)", chapter))).toEqual(["5"]);
      expect(lines(await run("print(draw_data(pair(1, 2)))", chapter))).toEqual(["[1, 2]"]);
    });

    test("ignores its other arguments", async () => {
      expect(lines(await run("print(draw_data(1, 2, 3))", chapter))).toEqual(["1"]);
    });

    test("can be called for its effect alone", async () => {
      expect(lines(await run("draw_data(llist(1, 2, 3))\nprint(0)", chapter))).toEqual(["0"]);
    });

    test("needs at least one argument", async () => {
      await expect(run("draw_data()", chapter)).rejects.toThrow();
    });
  });

  test("does not exist in chapter 1", async () => {
    await expect(run("draw_data(1)", 1)).rejects.toThrow(/draw_data/);
  });
});

describe("breakpoint, set_timeout and clear_all_timeout in the headless pvml runner", () => {
  test("breakpoint() is a no-op", async () => {
    expect(lines(await runCodePvmlInterpreter("breakpoint()\nprint(1)", 3))).toEqual(["1"]);
  });

  test("set_timeout is a no-op that never runs its callback", async () => {
    const code = "set_timeout(lambda: print('late'), 10)\nprint('now')";
    expect(lines(await runCodePvmlInterpreter(code, 3))).toEqual(["now"]);
  });

  test("clear_all_timeout() is a no-op", async () => {
    expect(lines(await runCodePvmlInterpreter("clear_all_timeout()\nprint(1)", 3))).toEqual(["1"]);
  });

  test.each([1, 2, 3, 4])("they resolve in chapter %i", async chapter => {
    const code = "breakpoint()\nset_timeout(lambda: 1, 5)\nclear_all_timeout()\nprint('ok')";
    expect(lines(await runCodePvmlInterpreter(code, chapter))).toEqual(["ok"]);
  });
});
