/**
 * Python §4 Typed on the CSE machine and in the environment stepper (as on py2js, see
 * typecheck-evaluator.test.ts): the type checker runs first, with whichever engine the student chose,
 * and a program with type errors is not run (or stepped), and each error is shown with its place.
 */
import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { StmtNS } from "../ast-types";
import { TypedPyCseEvaluatorBase } from "../conductor/TypedPyCseEvaluator";
import { TypedPyEStepperEvaluatorBase } from "../conductor/TypedPyEStepperEvaluator";
import type { TypedPythonChecker } from "../typecheck";
import { CHECKER_SETUP_TIMEOUT_MS, startTypedChecker } from "./typecheck-harness";

jest.setTimeout(60_000);

interface SentError {
  name: string;
  message: string;
  errorType?: string;
  line?: number;
  column?: number;
}

/** A conductor that records what it is sent. */
function mockConductor(plugin: object) {
  const errors: SentError[] = [];
  const outputs: string[] = [];
  const conductor = {
    sendResult: () => undefined,
    sendError: (error: SentError) => errors.push(error),
    sendOutput: (output: string) => outputs.push(output),
    updateStatus: () => undefined,
    hostLoadPlugin: () => undefined,
    requestFile: () => Promise.resolve(null),
    requestInput: () => Promise.resolve(""),
    registerPlugin: () => plugin,
  } as unknown as IRunnerPlugin;
  return { conductor, errors, outputs };
}

describe("Python §4 Typed on the CSE machine", () => {
  let checker: TypedPythonChecker;
  beforeEach(async () => {
    checker = await startTypedChecker();
  }, CHECKER_SETUP_TIMEOUT_MS);
  afterEach(() => checker.dispose());

  function cse() {
    const snapshots: unknown[] = [];
    const { conductor, errors, outputs } = mockConductor({
      sendSnapshots: (s: unknown) => snapshots.push(s),
      // Chapter 2 and up register the data visualizer too.
      resetRun: () => undefined,
      sendRun: () => undefined,
      drawData: () => undefined,
    });
    class Evaluator extends TypedPyCseEvaluatorBase {
      constructor() {
        super(conductor, checker);
      }
    }
    const evaluator = new Evaluator();
    return { errors, outputs, snapshots, run: (code: string) => evaluator.evaluateChunk(code) };
  }

  test("a typed program is checked, and runs on the CSE machine without its types", async () => {
    const { run, errors, outputs, snapshots } = cse();
    await run(
      "def f(n: int) -> int:\n    return 1 if n == 0 else n * f(n - 1)\ncount: int = f(5)\nprint(count)\n",
    );
    expect(errors).toEqual([]);
    expect(outputs.join("")).toContain("120");
    expect(snapshots).toHaveLength(1);
  });

  test("a type error is not run, and the message says where it is, as the CSE machine's errors do", async () => {
    const { run, errors, outputs, snapshots } = cse();
    await run('print("before")\nx: int = "a"\nprint("after")');
    expect(outputs).toEqual([]);
    expect(snapshots).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].name).toBe("StaticTypeError");
    expect(errors[0].errorType).toBe("__evaluator_type");
    expect(errors[0].message).toBe(
      'StaticTypeError at line 2\n\n    x: int = "a"\n             ^~~\nType "str" is not assignable to declared type "int"',
    );
  });

  test("every type error is shown", async () => {
    const { run, errors } = cse();
    await run("def f(n: int) -> int:\n    return n\nf('a')\nif 1:\n    pass");
    expect(errors.map(e => e.message.split("\n")[0])).toEqual([
      "StaticTypeError at line 3",
      "StaticTypeError at line 4",
    ]);
  });

  test("a function without annotations is rejected by the rules of Python §4 Typed", async () => {
    const { run, errors, outputs } = cse();
    await run("def f(x):\n    return x\nprint(1)");
    expect(outputs).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/parameter 'x' of function 'f' needs a type/);
  });

  test("a chunk that the machine rejects after the types are checked is not part of the session", async () => {
    const { run, errors, outputs } = cse();
    // The types are right; the Resolver rejects `sorted`, which Python §4 does not have.
    await run("xs: list[int] = [1]\nprint(sorted(xs))");
    // So `xs: list[int]` was never declared: this is a new variable of another type.
    await run('xs = ["a"]\nprint(xs)');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/sorted/);
    expect(outputs.join("")).toContain("a");
  });

  test("the chunks of a REPL session build on each other", async () => {
    const { run, errors, outputs } = cse();
    await run("def sq(x: int) -> int:\n    return x * x");
    await run("print(sq(3))");
    await run('print(sq("a"))');
    await run("print(sq(4))");
    expect(outputs.join("")).toContain("9");
    expect(outputs.join("")).toContain("16");
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("sq expects x to be int, but got str");
  });
});

describe("Python §4 Typed in the environment stepper", () => {
  let checker: TypedPythonChecker;
  beforeEach(async () => {
    checker = await startTypedChecker();
  }, CHECKER_SETUP_TIMEOUT_MS);
  afterEach(() => checker.dispose());

  function stepper() {
    const stepped: StmtNS.FileInput[] = [];
    const sources: string[] = [];
    const { conductor, errors } = mockConductor({
      setStepLimit: () => undefined,
      setSource: (source: string) => sources.push(source),
      sendSteps: (ast: StmtNS.FileInput) => {
        stepped.push(ast);
        return Promise.resolve();
      },
    });
    class Evaluator extends TypedPyEStepperEvaluatorBase {
      constructor() {
        super(conductor, checker);
      }
    }
    const evaluator = new Evaluator();
    return { errors, stepped, sources, run: (code: string) => evaluator.evaluateChunk(code) };
  }

  test("a typed program is checked, and stepped as a program of Python §4", async () => {
    const { run, errors, stepped, sources } = stepper();
    const code = "def f(n: int) -> int:\n    return n + 1\nx: int = f(1)";
    await run(code);
    expect(errors).toEqual([]);
    expect(stepped).toHaveLength(1);
    // The steps are those of the program without its types ...
    const [def, assign] = stepped[0].statements;
    expect(def).toBeInstanceOf(StmtNS.FunctionDef);
    expect((def as StmtNS.FunctionDef).returns).toBeNull();
    expect((def as StmtNS.FunctionDef).parameters[0].annotation).toBeUndefined();
    expect(assign).toBeInstanceOf(StmtNS.Assign);
    // ... and the program text that the stepper shows is the student's.
    expect(sources).toEqual([code + "\n"]);
  });

  test("a type error: no steps, and each error has its line and column", async () => {
    const { run, errors, stepped } = stepper();
    await run('x = 1\ny: int = "a"\nz: str = 2');
    expect(stepped).toEqual([]);
    expect(errors).toEqual([
      expect.objectContaining({
        name: "StaticTypeError",
        errorType: "__evaluator_type",
        line: 2,
        column: 9,
      }),
      expect.objectContaining({ name: "StaticTypeError", line: 3, column: 9 }),
    ]);
  });

  test("every program stands on its own: the names of an earlier one are not known", async () => {
    const { run, errors, stepped } = stepper();
    await run("def f() -> int:\n    return 1");
    // The stepper steps a program from the start: `f` is not defined in this one.
    await run("print(f())");
    expect(stepped).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/"f" is not defined/);
  });

  test("a function without annotations has no steps", async () => {
    const { run, errors, stepped } = stepper();
    await run("def f(x):\n    return x");
    expect(stepped).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/parameter 'x' of function 'f' needs a type/);
  });
});
