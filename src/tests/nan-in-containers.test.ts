/**
 * A nan inside a pair or list (py-slang#579): containers compare their elements by `x is y or
 * x == y` (the Python reference; PyPy's identity of a float is its bit pattern), so the same nan
 * in two pairs is equal, while `math_nan == math_nan` on its own stays False. The same answer in
 * every engine and every chapter; CPython gives it too (`[math.nan] == [math.nan]` is True).
 */
import { evaluatePython } from "../conductor/stepper/getSteps";
import { runCodePy2Js } from "../engines/py2js";
import { compileToWasmAndRun } from "../engines/wasm";
import { WASM_GROUPS } from "../engines/wasm/groups";
import { parse } from "../parser";
import { runCodePvmlInterpreter } from "../pvml-runner";
import { runCode } from "../runner";

type Run = (code: string, chapter: number) => Promise<string>;

const ENGINES: [string, Run][] = [
  ["cse", runCode],
  ["py2js", (code, chapter) => Promise.resolve(runCodePy2Js(code, chapter).output)],
  ["pvml", runCodePvmlInterpreter],
  [
    "wasm",
    async (code, chapter) => {
      const { errors, prints } = await compileToWasmAndRun(code, false, {
        chapter,
        groups: WASM_GROUPS[chapter],
      });
      if (errors.length > 0) throw new Error(errors.map(e => e.message).join("\n"));
      return prints.map(p => p + "\n").join("");
    },
  ],
];

// Pairs exist from §2 on, list literals from §3 on.
const PAIR_CASES: [string, string][] = [
  ["pair(math_nan, math_nan) == pair(math_nan, math_nan)", "True"],
  ["pair(math_nan, math_nan) != pair(math_nan, math_nan)", "False"],
  ["math_nan == math_nan", "False"],
  ["math_nan != math_nan", "True"],
  ["pair(pair(math_nan, 1), 2) == pair(pair(math_nan, 1), 2)", "True"],
  ["pair(math_nan, 1) == pair(math_nan, 2)", "False"],
  ["pair(math_nan, 1) == pair(1.5, 1)", "False"],
  ["pair(1, 2) == pair(1, 2)", "True"],
  ["pair(0.0, 1) == pair(-0.0, 1)", "True"],
];
// A complex number with a nan, shared by two containers (the same object in CPython).
const COMPLEX_PAIR_CASES: [string, string][] = [
  ["pair(c, 1) == pair(c, 1)", "True"],
  ["pair(c, 1) != pair(c, 1)", "False"],
  ["c == c", "False"],
];
const COMPLEX_LIST_CASES: [string, string][] = [
  ["[c] == [c]", "True"],
  ["[c] != [c]", "False"],
];
const LIST_CASES: [string, string][] = [
  ["[math_nan] == [math_nan]", "True"],
  ["[math_nan] != [math_nan]", "False"],
];

describe.each(ENGINES)("a nan in a container: %s", (_, run) => {
  describe.each([2, 3, 4])("§%i", chapter => {
    test.each(PAIR_CASES)("%s", async (expression, expected) => {
      expect(await run(`print(${expression})\n`, chapter)).toBe(expected + "\n");
    });
    test("a pair equals itself, nan inside or not", async () => {
      const code = "a = pair(math_nan, None)\nprint(a == a)\nprint(a != a)\n";
      expect(await run(code, chapter)).toBe("True\nFalse\n");
    });
    test.each(COMPLEX_PAIR_CASES)("%s, c = complex(math_nan, 0)", async (expression, expected) => {
      const code = `c = complex(math_nan, 0)\nprint(${expression})\n`;
      expect(await run(code, chapter)).toBe(expected + "\n");
    });
  });
  describe.each([3, 4])("§%i", chapter => {
    test.each(LIST_CASES)("%s", async (expression, expected) => {
      expect(await run(`print(${expression})\n`, chapter)).toBe(expected + "\n");
    });
    test.each(COMPLEX_LIST_CASES)("%s, c = complex(math_nan, 0)", async (expression, expected) => {
      const code = `c = complex(math_nan, 0)\nprint(${expression})\n`;
      expect(await run(code, chapter)).toBe(expected + "\n");
    });
  });
});

// The substitution stepper of §1/§2 (src/conductor/stepper) evaluates to the value of the last
// expression; it has pairs but no list literals.
describe("a nan in a pair: the stepper (§2)", () => {
  test.each(PAIR_CASES)("%s", async (expression, expected) => {
    expect(await evaluatePython(parse(expression + "\n"))).toBe(expected);
  });
  test("a pair equals itself, nan inside or not", async () => {
    const code = "a = pair(math_nan, None)\na == a\n";
    expect(await evaluatePython(parse(code))).toBe("True");
  });
  test.each(COMPLEX_PAIR_CASES)("%s, c = complex(math_nan, 0)", async (expression, expected) => {
    const code = `c = complex(math_nan, 0)\n${expression}\n`;
    expect(await evaluatePython(parse(code))).toBe(expected);
  });
});
