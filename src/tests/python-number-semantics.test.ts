/**
 * Python's arithmetic on ints and floats (py-slang#580): the same results as CPython's in every
 * engine. The issue's examples, and a seeded sample of the operators over ints (also beyond the
 * range of a float) and floats (zeros of both signs, huge, tiny, inf, nan). CPython's answers are
 * computed in one `python3` run; the tests skip themselves without `python3`.
 */
import { spawnSync } from "child_process";
import { evaluatePython } from "../conductor/stepper/getSteps";
import { runCodePy2Js } from "../engines/py2js";
import { parse } from "../parser";
import { runCodePvmlInterpreter } from "../pvml-runner";
import { runCode } from "../runner";

const python = spawnSync("python3", ["--version"]).status === 0;
const describeIfPython = python ? describe : describe.skip;

const INTS = [
  "0",
  "1",
  "-1",
  "3",
  "7",
  "-7",
  "10",
  "9007199254740993",
  "10**20",
  "-(10**20)",
  "10**308",
  "10**399",
  "10**400",
  "-(10**400)",
];
const SMALL_INTS = ["0", "1", "-1", "2", "-2", "3", "7", "-7", "10"];
const FLOATS = [
  "0.0",
  "-0.0",
  "0.1",
  "-0.1",
  "2.5",
  "-2.5",
  "5.0",
  "1e308",
  "-1e308",
  "1e-320",
  "math_inf",
  "-math_inf",
  "math_nan",
];
// Exponents that are floats: those where JavaScript's `**` and the C library's `pow` agree.
const POWER_FLOATS = [
  "0.0",
  "-0.0",
  "5.0",
  "-2.0",
  "0.5",
  "1e308",
  "-1e308",
  "math_inf",
  "-math_inf",
  "math_nan",
];
const OPERATORS = ["+", "-", "*", "/", "//", "%", "**"];

/** The examples of the issue. */
const EXAMPLES = [
  "1 // 0.1",
  "5 % -2.5",
  "-1 % 1.0",
  "-0.0 % 5",
  "10**400 / 10**399",
  "(10**400 + 1) / 10**399",
  "10**400 / 3",
  "10**400 * 1.0",
  "7 ** -2",
  "7.0 ** -2",
  "1e308 * 10",
  "2.5 ** 1000",
  "(-2.5) ** 3",
  "0.0 ** -math_inf",
  "10.0 ** 400",
  "0.1 ** 5000",
];

// A small linear congruential generator, so that the sample is the same in every run.
function sample(count: number): string[] {
  let state = 12345;
  const next = (n: number): number => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state % n;
  };
  const expressions: string[] = [];
  while (expressions.length < count) {
    const op = OPERATORS[next(OPERATORS.length)];
    const left = [...INTS, ...FLOATS][next(INTS.length + FLOATS.length)];
    const rightPool = op === "**" ? [...SMALL_INTS, ...POWER_FLOATS] : [...INTS, ...FLOATS];
    const right = rightPool[next(rightPool.length)];
    expressions.push(`(${left}) ${op} (${right})`);
  }
  return expressions;
}

type Expected = { value: string } | { error: string };

/** CPython's answer for each expression; null for a complex result (outside the language). */
function cpython(expressions: string[]): (Expected | null)[] {
  const script = `
import json, sys
math_inf = float("inf")
math_nan = float("nan")
out = []
for e in json.loads(sys.stdin.read()):
    try:
        v = eval(e)
        out.append(None if isinstance(v, complex) else {"value": repr(v)})
    except Exception as x:
        out.append({"error": type(x).__name__})
print(json.dumps(out))
`;
  const result = spawnSync("python3", ["-I", "-c", script], {
    input: JSON.stringify(expressions),
    encoding: "utf8",
    maxBuffer: 1 << 26,
  });
  return JSON.parse(result.stdout) as (Expected | null)[];
}

type Engine = [string, (code: string, chapter: number) => Promise<string>];

const ENGINES: Engine[] = [
  ["cse", (code, chapter) => runCode(code, chapter)],
  ["py2js", (code, chapter) => Promise.resolve(runCodePy2Js(code, chapter).output)],
  ["pvml", (code, chapter) => runCodePvmlInterpreter(code, chapter)],
];

function errorKindMatches(kind: string, message: string): boolean {
  // PVML's ZeroDivisionError message does not name the class.
  return kind === "ZeroDivisionError"
    ? /ZeroDivisionError|division|modulo|zero|negative power/i.test(message)
    : message.includes(kind);
}

describeIfPython("Python's arithmetic on numbers", () => {
  const expressions = [...EXAMPLES, ...sample(300)];
  const expected = cpython(expressions);
  const cases = expressions
    .map((expression, i) => [expression, expected[i]] as const)
    .filter((c): c is readonly [string, Expected] => c[1] !== null);

  async function outcome(run: Engine[1], chapter: number, expression: string, want: Expected) {
    try {
      return { value: (await run(`print(${expression})\n`, chapter)).trim() };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // The kind of the error: the one CPython names, or else the message itself.
      const kind = "error" in want ? want.error : "";
      return { error: errorKindMatches(kind, message) ? kind : message };
    }
  }

  describe.each(ENGINES)("%s", (_, run) => {
    test.each(cases)("%s", async (expression, want) => {
      expect(await outcome(run, 4, expression, want)).toEqual(want);
    });
    // The issue's examples in the other chapters too.
    describe.each([1, 2, 3])("§%i", chapter => {
      test.each(cases.slice(0, EXAMPLES.length))("%s", async (expression, want) => {
        expect(await outcome(run, chapter, expression, want)).toEqual(want);
      });
    });
  });

  // The substitution stepper of §1/§2 evaluates to the value of the last expression.
  test.each(cases.filter(([, want]) => "value" in want))(
    "stepper: %s",
    async (expression, want) => {
      expect(await evaluatePython(parse(expression + "\n"))).toBe(
        (want as { value: string }).value,
      );
    },
  );
});
