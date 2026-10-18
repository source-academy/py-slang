/**
 * Compile-time errors (py-slang#580): CPython rejects these programs with a SyntaxError before it
 * runs anything; so does every engine now (the Resolver, which all of them run first). The programs
 * that look similar but are fine must still run. CPython's verdict is computed with `python3`; the
 * tests skip themselves without it.
 */
import { spawnSync } from "child_process";
import { runCodePy2Js } from "../engines/py2js";
import { compileToWasmAndRun } from "../engines/wasm";
import { WASM_GROUPS } from "../engines/wasm/groups";
import { analyze } from "../resolver";
import { parse } from "../parser";
import { runCodePvmlInterpreter } from "../pvml-runner";
import { runCode } from "../runner";

const python = spawnSync("python3", ["--version"]).status === 0;
const describeIfPython = python ? describe : describe.skip;

const digits = (n: number): string => "9".repeat(n);

const REJECTED: [string, string][] = [
  ["a duplicate parameter", "print('before')\ndef f(x, x):\n    pass\n"],
  ["a duplicate parameter among others", "print('before')\ndef f(a, b, a, c):\n    return 1\n"],
  ["a duplicate parameter of a lambda", "print('before')\nf = lambda x, x: x\n"],
  ["a module-level return", "print('before')\nreturn 1\n"],
  ["a return in a loop at module level", "print('before')\nfor i in range(2):\n    return i\n"],
  ["a return in a branch at module level", "print('before')\nif True:\n    return 1\n"],
  ["a decimal literal of 4301 digits", `print('before')\nx = ${digits(4301)}\n`],
  [
    "a decimal literal of 4301 digits with underscores",
    `print('before')\nx = ${"9_".repeat(4300)}9\n`,
  ],
  [
    "a decimal literal of 5000 digits in an expression",
    `print('before')\nprint(1 + ${digits(5000)})\n`,
  ],
];

const ACCEPTED: [string, string][] = [
  ["distinct parameters", "def f(x, y):\n    return x + y\nprint(f(1, 2))\n"],
  [
    "a return in a function",
    "def f(x):\n    if x:\n        return 1\n    return 2\nprint(f(True))\n",
  ],
  [
    "a return in a nested function",
    "def f():\n    def g():\n        return 1\n    return g()\nprint(f())\n",
  ],
  ["a lambda with distinct parameters", "print((lambda x, y: x + y)(1, 2))\n"],
  ["a decimal literal of 4300 digits", `x = ${digits(4300)}\nprint(x > 0)\n`],
  [
    "a decimal literal of 4300 digits with underscores",
    `x = ${"9_".repeat(4299)}9\nprint(x > 0)\n`,
  ],
  ["a hexadecimal literal of 5000 digits", `x = 0x${"f".repeat(5000)}\nprint(x > 0)\n`],
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

function cpythonRejects(code: string): boolean {
  const result = spawnSync(
    "python3",
    ["-I", "-c", "import sys; compile(sys.stdin.read(), 'p', 'exec')"],
    {
      input: code,
      encoding: "utf8",
    },
  );
  return result.status !== 0 && result.stderr.includes("SyntaxError");
}

async function messageOf(run: Engine[1], code: string): Promise<string | null> {
  try {
    await run(code);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

describeIfPython("compile-time errors", () => {
  test.each(REJECTED)("CPython rejects %s", (_, code) => {
    expect(cpythonRejects(code)).toBe(true);
  });
  test.each(ACCEPTED)("CPython accepts %s", (_, code) => {
    expect(cpythonRejects(code)).toBe(false);
  });

  describe.each(ENGINES)("%s", (engine, run) => {
    test.each(REJECTED)("rejects %s before it runs anything", async (_, code) => {
      const message = await messageOf(run, code);
      expect(message).toMatch(/SyntaxError/);
    });
    // (wasm has 64-bit integers, so it cannot run the programs with a huge literal: #581.)
    test.each(ACCEPTED.filter(([name]) => !(engine === "wasm" && /literal/.test(name))))(
      "accepts %s",
      async (_, code) => {
        expect(await messageOf(run, code)).toBeNull();
      },
    );
  });

  test.each(REJECTED)("the analysis of the steppers rejects %s", (_, code) => {
    const errors = analyze(parse(code), code, 4);
    expect(errors.some(e => /SyntaxError/.test(e.name + e.message))).toBe(true);
  });
});
