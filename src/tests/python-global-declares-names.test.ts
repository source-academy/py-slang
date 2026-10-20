/**
 * A `global` declaration makes the name a name of the module (py-slang#614): CPython compiles
 * `def swap(y): print(x)` before `def g(): global x` without complaint, and fails at run time with a
 * NameError only if `swap` runs while nothing has bound `x`. The same in every engine that has
 * `global` (the WebAssembly one has none). CPython's answers are computed with `python3`; the tests
 * skip themselves without it.
 */
import { spawnSync } from "child_process";
import { runEStepper } from "../conductor/estepper/getSteps";
import { runCodePy2Js } from "../engines/py2js";
import { parse } from "../parser";
import { runCodePvmlInterpreter } from "../pvml-runner";
import { runCode } from "../runner";

const python = spawnSync("python3", ["--version"]).status === 0;
const describeIfPython = python ? describe : describe.skip;

const PROGRAMS: Record<string, string> = {
  "the program of the issue (swap is not called)":
    "def swap(y):\n    print(x)\n\ndef g():\n    global x\n",
  "swap is called, and nothing has bound x":
    "def swap(y):\n    print(x)\n\ndef g():\n    global x\n\nswap(1)\n",
  "g binds x before swap runs":
    "def swap(y):\n    print(x)\n\ndef g():\n    global x\n    x = 7\n\ng()\nswap(1)\n",
  "g is declared before swap":
    "def g():\n    global x\n    x = 7\n\ndef swap(y):\n    print(x)\n\ng()\nswap(1)\n",
  "the declaration is in a function in a function":
    "def outer():\n    def inner():\n        global z\n        z = 5\n    inner()\n\ndef reader():\n    return z\n\nouter()\nprint(reader())\n",
  "the declaration is in a branch and a loop":
    "def reader():\n    return a + b\n\ndef setter():\n    if True:\n        global a\n        a = 1\n    i = 0\n    while i < 1:\n        global b\n        b = 2\n        i = i + 1\n\nsetter()\nprint(reader())\n",
  "a reference at the top of the module": "print(x)\n\ndef g():\n    global x\n    x = 1\n",
  "the declaration is at the top of the module, after the function that reads the name":
    "def f():\n    return x\n\nglobal x\n\nprint(1)\n",
  "a name that is assigned at the top as well":
    "x = 3\n\ndef swap(y):\n    print(x)\n\ndef g():\n    global x\n    x = 4\n\nswap(1)\ng()\nswap(1)\n",
};

type Outcome = { output: string; error?: string };

function cpython(code: string): Outcome {
  const result = spawnSync("python3", ["-I", "-"], { input: code, encoding: "utf8" });
  const error =
    result.status === 0
      ? undefined
      : (/^(\w+Error)/m.exec(result.stderr.split("\n").slice(-3).join("\n"))?.[1] ?? "?");
  return { output: result.stdout, error };
}

const ENGINES: [string, (code: string) => Promise<string>][] = [
  ["cse", code => runCode(code, 4)],
  ["py2js", code => Promise.resolve(runCodePy2Js(code, 4).output)],
  ["pvml", code => runCodePvmlInterpreter(code, 4)],
  [
    "e-stepper",
    async code => {
      const run = await runEStepper(parse(code), code, 3, 5000);
      if (run.error !== undefined) throw new Error(run.error);
      return run.output;
    },
  ],
];

async function outcome(run: (code: string) => Promise<string>, code: string): Promise<Outcome> {
  try {
    return { output: await run(code) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const output = (e as { output?: string }).output ?? "";
    return { output, error: /NameError/.test(message) ? "NameError" : message };
  }
}

describeIfPython("global declarations declare names", () => {
  describe.each(ENGINES)("%s", (_, run) => {
    test.each(Object.entries(PROGRAMS))("%s", async (_name, code) => {
      const want = cpython(code);
      const got = await outcome(run, code);
      expect(got.error).toBe(want.error);
      // (the output before an error is the engine's: the REPL shows what was printed)
      if (want.error === undefined) expect(got.output.trim()).toBe(want.output.trim());
    });
  });

  test("a name that nothing declares is still rejected before the program runs", async () => {
    const code = "def f():\n    return nope\n\nprint(f())\n";
    await expect(runCode(code, 4)).rejects.toThrow(/NameNotFoundError/);
  });

  test("a name that another function declares global is not a name of this function's scope", async () => {
    // `x` is local to f (assigned there), so g's `global x` does not make f's use of x a global one
    const code = "def f():\n    print(x)\n    x = 1\n\ndef g():\n    global x\n\nf()\n";
    const want = cpython(code);
    expect(want.error).toBe("UnboundLocalError");
    const got = await outcome(code => runCode(code, 4), code);
    expect(got.error).toBeDefined();
  });
});
