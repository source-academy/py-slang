/**
 * Conductor-evaluator tests for py2js (mirrors PyPvmlEvaluator.test.ts).
 *
 * The interesting py2js-specific behavior is chunk persistence through the
 * runtime's module-level globals table (REPL compile mode): later chunks see
 * earlier bindings, earlier functions see later *redefinitions* (late
 * binding, as with the CSE machine's global environment), and reading a name
 * whose binding never executed raises NameError.
 */
import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { Py2JsEvaluator1, Py2JsEvaluator2 } from "../conductor/Py2JsEvaluator";

/** Minimal IRunnerPlugin mock: the evaluator calls sendResult/sendError/
 * sendOutput on its `conductor`, plus registerPlugin once in its constructor
 * (module-loader registration — see Py2JsEvaluator.ts); no test here imports
 * anything, so the stub just needs to exist, not do anything real. */
function makeMockConductor() {
  const results: unknown[] = [];
  const errors: { name: string; message: string }[] = [];
  const outputs: string[] = [];
  const conductor = {
    sendResult: (r: unknown) => results.push(r),
    sendError: (e: unknown) => errors.push(e as { name: string; message: string }),
    sendOutput: (m: string) => outputs.push(m),
    registerPlugin: () => undefined,
  } as unknown as IRunnerPlugin;
  return { conductor, results, errors, outputs };
}

describe("Py2JsEvaluator1", () => {
  test("persists a global variable across evaluateChunk calls", async () => {
    const { conductor, results, errors, outputs } = makeMockConductor();
    const evaluator = new Py2JsEvaluator1(conductor);

    await evaluator.evaluateChunk("x = 5\n");
    await evaluator.evaluateChunk("print(x + 1)\n");

    expect(errors).toEqual([]);
    // Exec-style: chunks never report a result value; print() is the way to
    // surface one (same convention as the PVML-in-browser evaluator).
    expect(results).toEqual([undefined, undefined]);
    expect(outputs).toEqual(["6"]);
  });

  test("persists a function definition across evaluateChunk calls", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new Py2JsEvaluator1(conductor);

    await evaluator.evaluateChunk("def f(x):\n    return x * 2\n");
    await evaluator.evaluateChunk("print(f(21))\n");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["42"]);
  });

  test("earlier functions see later redefinitions (late binding, CSE parity)", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new Py2JsEvaluator1(conductor);

    await evaluator.evaluateChunk("def g():\n    return 1\ndef f():\n    return g()\n");
    await evaluator.evaluateChunk("print(f())\n");
    await evaluator.evaluateChunk("def g():\n    return 2\n");
    await evaluator.evaluateChunk("print(f())\n");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["1", "2"]);
  });

  test("an erroring chunk reports through sendError and does not kill the session", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new Py2JsEvaluator1(conductor);

    await evaluator.evaluateChunk("x = 10\n");
    await evaluator.evaluateChunk("print(1 / 0)\n");
    await evaluator.evaluateChunk("print(x)\n");

    expect(errors).toHaveLength(1);
    expect(errors[0].name).toBe("ZeroDivisionError");
    expect(outputs).toEqual(["10"]);
  });

  test("undefined names are analysis errors; never-executed bindings are NameErrors", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new Py2JsEvaluator1(conductor);

    // Statically unknown name: rejected by the resolver.
    await evaluator.evaluateChunk("print(nope)\n");
    expect(errors).toHaveLength(1);

    // Bound at top level but only in a not-taken branch: known to the
    // resolver within the chunk, but reading it at runtime is a NameError.
    await evaluator.evaluateChunk("if 1 > 2:\n    y = 1\nprint(y)\n");
    expect(errors).toHaveLength(2);
    expect(errors[1].name).toBe("NameError");
    expect(outputs).toEqual([]);
  });

  test("deep tail recursion works across chunks (trampoline in REPL mode)", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new Py2JsEvaluator1(conductor);

    await evaluator.evaluateChunk(
      "def count(n, acc):\n    return acc if n == 0 else count(n - 1, acc + n)\n",
    );
    await evaluator.evaluateChunk("print(count(1000000, 0))\n");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["500000500000"]);
  });

  test("bridged stdlib and chapter-1 validators are active per chunk", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new Py2JsEvaluator1(conductor);

    await evaluator.evaluateChunk("print(abs(complex(-3, 4)))\n");
    // `is` is rejected at chapter 1 by the validators.
    await evaluator.evaluateChunk("print(1 is 1)\n");

    expect(outputs).toEqual(["5.0"]);
    expect(errors).toHaveLength(1);
  });

  test("multi-line prints stream one sendOutput per print call", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new Py2JsEvaluator1(conductor);

    await evaluator.evaluateChunk('print(1)\nprint("a", "b")\nprint()\n');

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["1", "a b", ""]);
  });
});

describe("Py2JsEvaluator2", () => {
  test("the linked-list prelude is available from the first chunk, and pairs persist across chunks", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new Py2JsEvaluator2(conductor);

    await evaluator.evaluateChunk("xs = pair(1, pair(2, pair(3, None)))\n");
    await evaluator.evaluateChunk("print(length(xs))\n");
    await evaluator.evaluateChunk("print(reverse(xs))\n");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["3", "[3, [2, [1, None]]]"]);
  });

  test("a function defined in one chunk works as a callback passed to a later chunk's map", async () => {
    const { conductor, errors, outputs } = makeMockConductor();
    const evaluator = new Py2JsEvaluator2(conductor);

    await evaluator.evaluateChunk("def double(x):\n    return x * 2\n");
    await evaluator.evaluateChunk("print(map(double, pair(1, pair(2, None))))\n");

    expect(errors).toEqual([]);
    expect(outputs).toEqual(["[2, [4, None]]"]);
  });
});
