import { DataType, TypedValue } from "@sourceacademy/conductor/types";
import { FeatureNotSupportedError } from "../validator";
import {
  EvaluatorEngine,
  makeEvaluatorTestHarness,
  resetEvaluatorTestModules,
} from "./evaluatorTestHarness";
import { toPythonAstAndResolve } from "./utils";

afterEach(resetEvaluatorTestModules);

async function run(engine: EvaluatorEngine, chapter: number, code: string) {
  const harness = makeEvaluatorTestHarness(engine, chapter);
  await harness.evaluate(code.endsWith("\n") ? code : code + "\n");
  return {
    // Chunking differs: the CSE machine batches prints and ends each line with "\n", py2js emits
    // one chunk per print without one. Compare line by line.
    output: harness.outputs.flatMap(chunk => chunk.replace(/\n$/, "").split("\n")),
    errors: harness.errors.map(e => e.message),
  };
}

/** Programs both engines must run identically: [label, code, expected printed lines]. */
const PROGRAMS: [string, string, string[]][] = [
  ["a lone rest parameter", "def f(*args):\n    print(args)\nf(1, 2, 3)", ["[1, 2, 3]"]],
  ["a rest parameter given nothing", "def f(*args):\n    print(args)\nf()", ["[]"]],
  [
    "fixed parameters before the rest parameter",
    "def f(a, b, *rest):\n    print(a)\n    print(b)\n    print(rest)\nf(1, 2, 3, 4)",
    ["1", "2", "[3, 4]"],
  ],
  [
    "a rest parameter that gets no surplus arguments",
    "def f(a, *rest):\n    print(a)\n    print(rest)\nf(1)",
    ["1", "[]"],
  ],
  ["a lambda with a rest parameter", "f = lambda *a: a\nprint(f(1, 2))", ["[1, 2]"]],
  [
    "a lambda with a fixed and a rest parameter",
    "f = lambda a, *r: r\nprint(f(1, 2, 3))",
    ["[2, 3]"],
  ],
  [
    "the rest list is a fresh, mutable list",
    "def f(*a):\n    a[0] = 9\n    return a\nprint(f(1, 2))\nprint(f(1, 2))",
    ["[9, 2]", "[9, 2]"],
  ],
  ["spreading a list into fixed parameters", "def g(a, b):\n    print(a + b)\ng(*[1, 2])", ["3"]],
  [
    "spreading mixed with ordinary arguments",
    "def h(a, b, c, d):\n    print(a, b, c, d)\nxs = [1, 2]\nh(0, *xs, 9)",
    ["0 1 2 9"],
  ],
  ["several spreads in one call", "def f(*r):\n    print(r)\nf(*[1], *[], *[2, 3])", ["[1, 2, 3]"]],
  ["spreading an empty list", "def f(*r):\n    print(r)\nf(*[])", ["[]"]],
  [
    "a spread does not alias the spread list",
    "xs = [1, 2]\ndef f(*a):\n    a[0] = 9\nf(*xs)\nprint(xs)",
    ["[1, 2]"],
  ],
  ["spreading into a builtin", "xs = [1, 2, 3]\nprint(*xs)\nprint(max(*xs))", ["1 2 3", "3"]],
  [
    "a rest function calling itself in tail position, spreading its rest list",
    "def count(n, *acc):\n    if n == 0:\n        return len(acc)\n    else:\n        return count(n - 1, *acc, n)\nprint(count(10))",
    ["10"],
  ],
  [
    "arity() of a variadic function is its number of fixed parameters",
    "def f(a, b, *r):\n    return 1\nprint(arity(f))\nprint(arity(lambda *a: a))",
    ["2", "0"],
  ],
  [
    "a rest function passed to map",
    "def f(x, *r):\n    return x + 1\nprint(llist_to_string(map(f, llist(1, 2))))",
    ["[2, [3, None]]"],
  ],
];

/** Programs both engines must reject with some error (the wording is engine-specific). */
const ERRORS: [string, string][] = [
  ["spreading a non-list", "def f(*r):\n    return r\nf(*5)"],
  ["spreading a string", "def f(*r):\n    return r\nf(*'ab')"],
  ["too few arguments for the fixed parameters", "def f(a, b, *r):\n    return a\nf(1)"],
];

describe.each<EvaluatorEngine>(["pycse", "py2js"])("rest parameters and spread: %s", engine => {
  describe.each([3, 4])("chapter %i", chapter => {
    test.each(PROGRAMS)("%s", async (_label, code, expected) => {
      const result = await run(engine, chapter, code);
      expect(result.errors).toEqual([]);
      expect(result.output).toEqual(expected);
    });

    test.each(ERRORS)("rejects %s", async (_label, code) => {
      const result = await run(engine, chapter, code);
      expect(result.errors).toHaveLength(1);
    });
  });
});

describe("py2js tail calls", () => {
  // The CSE machine's step limit stops it well before this depth, so this isn't a parity case.
  test("a rest function tail-calling itself is stack-safe", async () => {
    const result = await run(
      "py2js",
      3,
      "def loop(n, *r):\n    if n == 0:\n        return len(r)\n    else:\n        return loop(n - 1, *r)\nprint(loop(200000, 1, 2))",
    );
    expect(result.errors).toEqual([]);
    expect(result.output).toEqual(["2"]);
  });
});

describe("py2js dual mode (a program that imports a module)", () => {
  // Importing makes the program's spine async and compiles every function twice (sync + async
  // body); the rest parameter and the spread must behave the same in both bodies.
  test("rest parameters and spread work next to a module call", async () => {
    const harness = makeEvaluatorTestHarness("py2js", 3);
    const double = await harness.dataHandler.closure_make(
      { args: [DataType.NUMBER], returnType: DataType.NUMBER },
      async function* (
        value: TypedValue<DataType.NUMBER>,
      ): AsyncGenerator<void, TypedValue<DataType.NUMBER>, undefined> {
        await Promise.resolve();
        return { type: DataType.NUMBER, value: value.value * 2 };
      },
    );
    harness.installModule("m", [{ symbol: "double", value: double }]);

    await harness.evaluate(
      [
        "from m import double",
        "def f(a, *rest):",
        "    return double(a) + len(rest)",
        "g = lambda *r: r",
        "print(f(*[1, 5, 6]))",
        "print(g(*[1, 2], 3))",
        "",
      ].join("\n"),
    );

    expect(harness.errors).toEqual([]);
    expect(harness.outputs.flatMap(c => c.replace(/\n$/, "").split("\n"))).toEqual([
      "4.0",
      "[1, 2, 3]",
    ]);
  });
});

describe("py2js rest functions called back by a module", () => {
  // A module invokes a Python callback through the data handler's checked closure_call, which
  // rejects surplus arguments unless the closure was registered vararg (as CSE and PVML do).
  async function callbackProgram(engine: EvaluatorEngine, call: number[], def: string) {
    const harness = makeEvaluatorTestHarness(engine, 3);
    const dh = harness.dataHandler;
    const num = (value: number): TypedValue<DataType.NUMBER> => ({ type: DataType.NUMBER, value });
    const callWith = await dh.closure_make(
      { returnType: DataType.ANY, args: [DataType.CLOSURE] },
      async function* (f: TypedValue<DataType.CLOSURE>) {
        return yield* dh.closure_call(f, call.map(num), DataType.ANY);
      },
    );
    harness.installModule("m", [{ symbol: "call_with", value: callWith }]);
    await harness.evaluate(`from m import call_with\n${def}\nprint(call_with(f))\n`);
    return {
      errors: harness.errors.map(e => e.message),
      output: harness.outputs.flatMap(c => c.replace(/\n$/, "").split("\n")),
    };
  }

  test.each<EvaluatorEngine>(["pycse", "py2js"])(
    "%s: the module can pass more arguments than the fixed parameters",
    async engine => {
      const result = await callbackProgram(
        engine,
        [1, 2, 3],
        "def f(a, *rest):\n    return a + len(rest)",
      );
      expect(result.errors).toEqual([]);
      expect(result.output).toEqual(["3.0"]);
    },
  );

  test.each<EvaluatorEngine>(["pycse", "py2js"])(
    "%s: a rest function with no fixed parameters collects every argument",
    async engine => {
      const result = await callbackProgram(engine, [4, 5], "def f(*all):\n    return len(all)");
      expect(result.errors).toEqual([]);
      expect(result.output).toEqual(["2.0"]);
    },
  );

  test("py2js: too few arguments from the module is still an arity error", async () => {
    const result = await callbackProgram("py2js", [], "def f(a, *rest):\n    return a");
    expect(result.errors).toHaveLength(1);
  });
});

describe("py2js error wording", () => {
  test("too few arguments names the lower bound", async () => {
    const result = await run("py2js", 3, "def f(a, b, *r):\n    return a\nf(1)");
    expect(result.errors[0]).toContain("f() takes at least 2 arguments but 1 was given");
  });

  test("a single missing fixed parameter is singular", async () => {
    const result = await run("py2js", 3, "def f(a, *r):\n    return a\nf()");
    expect(result.errors[0]).toContain("f() takes at least 1 argument but 0 were given");
  });

  test("spreading a non-list names its type", async () => {
    const result = await run("py2js", 3, "def f(*r):\n    return r\nf(*5)");
    expect(result.errors[0]).toContain("argument after * must be a list, not 'int'");
  });

  test.each([
    ["def", "def f(*a, b):\n    return 1\n"],
    ["lambda", "f = lambda *a, b: 1\n"],
  ])("rejects a rest parameter that is not last in a %s", async (_label, code) => {
    const result = await run("py2js", 3, code);
    expect(result.errors[0]).toContain("a rest parameter (*args) must be the last parameter");
  });
});

describe("chapters 1 and 2 still reject rest parameters and spread", () => {
  test.each([1, 2])("chapter %i", chapter => {
    expect(() => toPythonAstAndResolve("def f(*a):\n    return a", chapter)).toThrow(
      FeatureNotSupportedError,
    );
    expect(() => toPythonAstAndResolve("def f(a):\n    return a\nf(*[1])", chapter)).toThrow(
      FeatureNotSupportedError,
    );
  });
});
