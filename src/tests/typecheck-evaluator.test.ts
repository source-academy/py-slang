/**
 * The Typed Python §4 evaluator (src/conductor/TypedPy2JsEvaluator.ts), with a conductor that records
 * what it is sent, and the real checker in a worker thread.
 */
import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { TypedPy2JsEvaluatorBase } from "../conductor/TypedPy2JsEvaluator";
import { LazyChecker, type ChunkChecker, type TypedPythonChecker } from "../typecheck";
import { CHECKER_SETUP_TIMEOUT_MS, startTypedChecker } from "./typecheck-harness";

jest.setTimeout(60_000);

interface SentError {
  name: string;
  message: string;
  line?: number;
  column?: number;
}

function makeEvaluator(checker: ChunkChecker) {
  const errors: SentError[] = [];
  const outputs: string[] = [];
  const results: unknown[] = [];
  const conductor = {
    sendResult: (result: unknown) => results.push(result),
    sendError: (error: SentError) => errors.push(error),
    sendOutput: (output: string) => outputs.push(output),
    hostLoadPlugin: () => undefined,
    requestFile: () => Promise.resolve(null),
    requestInput: () => Promise.resolve(""),
    registerPlugin: () => ({
      sendSnapshots: () => undefined,
      resetRun: () => undefined,
      sendRun: () => undefined,
      drawData: () => undefined,
    }),
  } as unknown as IRunnerPlugin;
  class TestEvaluator extends TypedPy2JsEvaluatorBase {
    constructor() {
      super(conductor, 4, checker);
    }
  }
  const evaluator = new TestEvaluator();
  return {
    errors,
    outputs,
    results,
    run: (code: string) => evaluator.evaluateChunk(code),
    runFile: (name: string, code: string) => evaluator.evaluateFile(name, code),
  };
}

describe("the Typed Python §4 evaluator", () => {
  let checker: TypedPythonChecker;
  beforeEach(async () => {
    checker = await startTypedChecker();
  }, CHECKER_SETUP_TIMEOUT_MS);
  afterEach(() => checker.dispose());

  test("a typed program is checked, and runs without its types", async () => {
    const { run, outputs, errors, results } = makeEvaluator(checker);
    await run(
      [
        "type Rational = Pair[int, int]",
        "def make(n: int, d: int) -> Rational:",
        "    return pair(n, d)",
        "def total[A](xs: LList[A], f: Callable[[A], int]) -> int:",
        "    return 0 if is_none(xs) else f(head(xs)) + total(tail(xs), f)",
        "count: int = 0",
        "count = count + total(llist(1, 2, 3), lambda x: x * 10)",
        "print(count)",
        "print(head(make(3, 4)))",
      ].join("\n"),
    );
    expect(errors).toEqual([]);
    expect(outputs).toEqual(["60", "3"]);
    expect(results).toEqual([undefined]);
  });

  test("a program with a type error is not run, and the error has its place", async () => {
    const { run, outputs, errors, results } = makeEvaluator(checker);
    await run('print("before")\nx: int = "a"\nprint("after")\n');
    expect(outputs).toEqual([]);
    expect(results).toEqual([]);
    expect(errors).toEqual([
      expect.objectContaining({
        name: "StaticTypeError",
        message: 'Type "str" is not assignable to declared type "int"',
        line: 2,
        column: 9,
      }),
    ]);
  });

  test("every type error is reported, in the order of the program", async () => {
    const { run, outputs, errors } = makeEvaluator(checker);
    await run(
      "def f(n: int) -> int:\n    return n\nf('a')\nxs = llist(1)\nhead(xs)\nif 1:\n    pass\n",
    );
    expect(outputs).toEqual([]);
    expect(errors.map(e => [e.line, e.message.split(".")[0]])).toEqual([
      [3, "f expects n to be int, but got str"],
      [5, "head expects p to be Pair[H, Any], but got LList[int]"],
      [6, "A condition must be a bool, but this is an int"],
    ]);
  });

  test("a function without annotations is rejected by the rules of Typed Python §4, with its place", async () => {
    const { run, outputs, errors } = makeEvaluator(checker);
    await run("def f(x: int, y) -> int:\n    return x\nprint(1)\n");
    expect(outputs).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ name: "MissingTypeAnnotationError" });
    expect(errors[0].message).toMatch(/parameter 'y' of function 'f' needs a type/);
  });

  test("the chunks of a REPL session build on each other", async () => {
    const { run, outputs, errors } = makeEvaluator(checker);
    await run("def sq(x: int) -> int:\n    return x * x\ntotal: int = 0\n");
    await run("total = total + sq(3)\nprint(total)\n");
    // A chunk with a type error: not run, and not part of the session.
    await run('print(sq("a"))\nsecret: int = 1\n');
    await run("total = total + sq(4)\nprint(total)\n");
    await run("print(secret)\n");
    expect(outputs).toEqual(["9", "25"]);
    expect(errors.map(e => e.message)).toEqual([
      "sq expects x to be int, but got str",
      expect.stringContaining('"secret" is not defined'),
    ]);
  });

  test("a name that the checker knows but Python §4 lacks is rejected by the Resolver, after the checker", async () => {
    const { run, outputs, errors } = makeEvaluator(checker);
    await run("xs: list[int] = [3, 1, 2]\nprint(sorted(xs))\n");
    expect(outputs).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/sorted/);
  });

  test("a program can be given as a file", async () => {
    const { runFile, outputs, errors } = makeEvaluator(checker);
    await runFile("/main.py", "def f(n: int) -> int:\n    return n + 1\nprint(f(1))\n");
    expect(errors).toEqual([]);
    expect(outputs).toEqual(["2"]);
  });

  test("a warning or a hint does not stop a program", async () => {
    const { run, outputs, errors } = makeEvaluator(checker);
    // The parameter is not used: a hint.
    await run("def f(unused: int) -> int:\n    return 1\nprint(f(0))\n");
    expect(errors).toEqual([]);
    expect(outputs).toEqual(["1"]);
  });

  test("a program that is not Typed Python (types that are wrong at run time) is not a concern of the checker", async () => {
    const { run, outputs, errors } = makeEvaluator(checker);
    // 1 / 0 has no static error; it fails when it runs, as in Python §4.
    await run("def f(n: int) -> float:\n    return 1 / n\nprint(f(0))\n");
    expect(outputs).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].name).not.toBe("StaticTypeError");
  });
});

describe("a checker that cannot be started", () => {
  test(
    "a program is not run unchecked; the next run tries again",
    async () => {
      let attempts = 0;
      let real: TypedPythonChecker | undefined;
      const lazy = new LazyChecker(async () => {
        attempts++;
        if (attempts === 1) throw new Error("network down");
        real = await startTypedChecker();
        return real;
      });
      const { run, outputs, errors } = makeEvaluator(lazy);

      await run('print("hello")\n');
      expect(outputs).toEqual([]);
      expect(errors).toHaveLength(1);
      expect(errors[0].name).toBe("TypeCheckerUnavailableError");
      expect(errors[0].message).toMatch(
        /network down.*not run a program that has not been checked/s,
      );

      await run('print("hello")\n');
      expect(attempts).toBe(2);
      expect(outputs).toEqual(["hello"]);
      real?.dispose();
    },
    CHECKER_SETUP_TIMEOUT_MS,
  );
});
