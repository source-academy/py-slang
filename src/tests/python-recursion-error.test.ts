/**
 * Unbounded recursion (py-slang#580): every engine reports Python's RecursionError, not an error of
 * the JavaScript engine under it (a RangeError, or a message of its own). The recursion is not a
 * tail call, which the engines run in constant space.
 */
import { runEStepper } from "../conductor/estepper/getSteps";
import { runCodePy2Js } from "../engines/py2js";
import { compileToWasmAndRun } from "../engines/wasm";
import { WASM_GROUPS } from "../engines/wasm/groups";
import { isStackOverflow, RECURSION_ERROR_MESSAGE } from "../errors/recursion";
import { parse } from "../parser";
import { runCodePvmlInterpreter } from "../pvml-runner";
import { runCode } from "../runner";

const FOREVER = "def f(n):\n    return 1 + f(n + 1)\nprint(f(0))\n";
const MUTUALLY = "def f(n):\n    return 1 + g(n)\ndef g(n):\n    return 2 + f(n)\nprint(f(0))\n";

const message = async (run: () => unknown): Promise<string> => {
  try {
    await run();
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return "no error";
};

describe("the helper", () => {
  test("recognizes the JavaScript stack running out", () => {
    const recurse = (): number => 1 + recurse();
    let caught: unknown;
    try {
      recurse();
    } catch (e) {
      caught = e;
    }
    expect(isStackOverflow(caught)).toBe(true);
    expect(isStackOverflow(new RangeError("Invalid array length"))).toBe(false);
    expect(isStackOverflow(new Error("Maximum call stack size exceeded"))).toBe(false);
  });
});

describe.each([
  ["cse", (code: string) => runCode(code, 4)],
  ["py2js", (code: string) => Promise.resolve(runCodePy2Js(code, 4).output)],
  ["pvml", (code: string) => runCodePvmlInterpreter(code, 4)],
])("%s", (_, run) => {
  test.each([FOREVER, MUTUALLY])("a recursion without end", async code => {
    expect(await message(() => run(code))).toContain("RecursionError");
  });
  test("the message is CPython's", async () => {
    const text = await message(() => run(FOREVER));
    if (_ !== "cse") expect(text).toContain(RECURSION_ERROR_MESSAGE);
  });
});

test("wasm", async () => {
  const { errors } = await compileToWasmAndRun(FOREVER, false, {
    chapter: 4,
    groups: WASM_GROUPS[4],
  });
  expect(errors.map(e => e.message).join("\n")).toContain("RecursionError");
});

describe("the e-stepper", () => {
  test.each([FOREVER, MUTUALLY])("a recursion without end", async code => {
    const run = await runEStepper(parse(code), code, 3, 100000);
    expect(run.truncated).toBe(false);
    expect(run.error).toMatch(/^RecursionError/);
    // The failing step is shown like any other runtime error.
    expect(run.steps[run.steps.length - 2].markers?.[0]?.explanation).toBe(run.error);
  });
  test("a recursion that ends within the limit", async () => {
    const code = "def f(n):\n    return 0 if n == 0 else 1 + f(n - 1)\nf(250)\n";
    const run = await runEStepper(parse(code), code, 3, 100000);
    expect(run.error).toBeUndefined();
    expect(run.truncated).toBe(false);
  });
});
