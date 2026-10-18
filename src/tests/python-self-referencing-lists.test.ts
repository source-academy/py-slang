/**
 * A list that contains itself is shown as `[...]` where it recurs, as in CPython (py-slang#580): PVML
 * and wasm overflowed the JavaScript stack. A list that is shared but does not contain itself is
 * shown in full both times. (Each program prints once, as its last statement: wasm fails after a
 * print of a list that is not the last statement, see #431.) CPython's output is computed with `python3`; the tests skip themselves
 * without it.
 */
import { spawnSync } from "child_process";
import { runCodePy2Js } from "../engines/py2js";
import { compileToWasmAndRun } from "../engines/wasm";
import { WASM_GROUPS } from "../engines/wasm/groups";
import { runCodePvmlInterpreter } from "../pvml-runner";
import { runCode } from "../runner";

const python = spawnSync("python3", ["--version"]).status === 0;
const describeIfPython = python ? describe : describe.skip;

const PROGRAMS: [string, string][] = [
  ["a list that is its own element", "a = [1]\na[0] = a\nprint(a)\n"],
  ["a list that is its own last element", "a = [1, 2]\na[1] = a\nprint(a)\n"],
  ["two lists that contain each other", "a = [1]\nb = [a]\na[0] = b\nprint(a)\n"],
  ["a cycle inside another list", "a = [1]\na[0] = a\nprint([a, 2])\n"],
  ["the same list twice, with no cycle", "a = [1]\nprint([a, a])\n"],
  ["a list in a list in a list, with no cycle", "a = [[1], [2]]\nprint([a, a])\n"],
];

type Engine = [string, (code: string) => Promise<string>];

const ENGINES: Engine[] = [
  ["cse", code => runCode(code, 4)],
  ["py2js", code => Promise.resolve(runCodePy2Js(code, 4).output)],
  ["pvml", code => runCodePvmlInterpreter(code, 4)],
  [
    "wasm",
    async code => {
      const { errors, prints } = await compileToWasmAndRun(code, false, {
        chapter: 4,
        groups: WASM_GROUPS[4],
      });
      if (errors.length > 0) throw new Error(errors.map(e => e.message).join("\n"));
      return prints.map(p => p + "\n").join("");
    },
  ],
];

describeIfPython("a list that contains itself", () => {
  describe.each(PROGRAMS)("%s", (_, code) => {
    const expected = spawnSync("python3", ["-I", "-c", code], { encoding: "utf8" }).stdout;
    test.each(ENGINES)("%s", async (_, run) => {
      expect(await run(code)).toBe(expected);
    });
  });
});
