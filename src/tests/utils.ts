import { ConductorError, ErrorType } from "@sourceacademy/conductor/common";
import { StmtNS } from "../ast-types";
import { Context } from "../engines/cse/context";
import { CSEResultPromise, evaluate, IOptions } from "../engines/cse/interpreter";
import { Stash } from "../engines/cse/stash";
import { displayError } from "../engines/cse/streams";
import { SVMLCompiler } from "../engines/svml/svml-compiler";
import { SVMLInterpreter } from "../engines/svml/svml-interpreter";
import { RuntimeSourceError } from "../errors";
import { parse } from "../parser/parser-adapter";
import { Resolver } from "../resolver";
import { Group } from "../stdlib/utils";
import { PyComplexNumber, RecursivePartial, Result } from "../types";
import { makeValidatorsForChapter } from "../validator";
import Stmt = StmtNS.Stmt;

/**
 * Test-local replacement for the deleted pyRunner.runInContext.
 * Orchestrates: load groups → parse → resolve → evaluate → wrap result.
 */
async function runInContext(
  code: string,
  context: Context,
  options: RecursivePartial<IOptions> = {},
): Promise<Result> {
  // Load groups into context (builtins + preludes)
  if (!options.isPrelude && options.groups) {
    let prelude = "";
    for (const group of options.groups as Group[]) {
      for (const [name, value] of group.builtins) {
        context.nativeStorage.builtins.set(name, value);
      }
      prelude += group.prelude + "\n";
    }
    if (prelude.trim()) {
      await runInContext(prelude, context, { ...options, isPrelude: true, groups: [] });
    }
  }

  // Parse
  let pyAst: Stmt;
  try {
    const script = code + "\n";
    pyAst = parse(script);
    if (!options.isPrelude) {
      const resolver = new Resolver(
        script,
        pyAst,
        makeValidatorsForChapter(options.variant ?? 1),
        (options.groups as Group[]) ?? [],
        Object.keys(context.runtime.environments[0].head),
      );
      const errors = resolver.resolve(pyAst);
      if (errors.length > 0) throw errors[0];
    }
  } catch (error) {
    await displayError(context, error, ErrorType.EVALUATOR_SYNTAX);
    return CSEResultPromise(context, { type: "error", message: String(error) });
  }

  // Evaluate
  const result = await evaluate(code, pyAst, context, options as Partial<IOptions>);
  return CSEResultPromise(context, result);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Class<T> = new (...args: any[]) => T;

export type TestExpectedValue =
  | bigint
  | number
  | boolean
  | string
  | null
  | PyComplexNumber
  | Class<RuntimeSourceError>
  | Class<Error>;
/**
 * TestCases is a mapping from arguments to `describe` blocks, which map to an array of tuples of the form [code, expected, output], where:
 * - `code` is the code to be executed
 * - `expected` is the expected value of the expression, which can be a primitive value, null (for None), or an error class (for expected errors)
 * - `output` is the expected output to be printed to the console, or null if no output is expected
 */
export type TestCases = Record<string, [string, TestExpectedValue, string[] | null][]>;

export function toPythonAst(text: string): Stmt {
  const script = text + "\n";
  return parse(script);
}

export function toPythonAstAndResolve(text: string, variant: number): Stmt {
  const script = text + "\n";
  const ast = toPythonAst(text);
  const resolver = new Resolver(script, ast, makeValidatorsForChapter(variant));
  const errors = resolver.resolve(ast);
  if (errors.length > 0) {
    throw errors[0];
  }
  return ast;
}

type InternalTestCase = {
  label: TestExpectedValue;
  code: string;
  expected: TestExpectedValue;
  output: string[] | null;
};

export const createInternalTestCases = (tests: TestCases[string]): InternalTestCase[] => {
  return tests.map(([code, expected, output]) => ({
    label:
      expected instanceof Function &&
      (expected.prototype instanceof RuntimeSourceError || expected.prototype instanceof Error)
        ? expected.name
        : expected,
    code,
    expected,
    output,
  }));
};

type OutputType =
  | {
      type: "stdout";
      value: string;
    }
  | {
      type: "stderr";
      value: ConductorError;
    };
export const generateMockStreams = (context: Context, output: OutputType[]) => {
  const stdOutStream = new WritableStream<string>({
    write: (data: string) => {
      output.push({ type: "stdout", value: data });
    },
  });

  const stdErrStream = new WritableStream<ConductorError>({
    write: (data: ConductorError) => {
      output.push({ type: "stderr", value: data });
    },
  });

  const stdinStream = new ReadableStream<string>({
    start() {
      // No-op: we won't be pushing any data to stdin in our tests
    },
    pull() {
      // No-op
    },
    cancel() {
      // No-op
    },
  });
  context.streams = {
    initialised: true,
    stdout: {
      stream: stdOutStream,
      writer: stdOutStream.getWriter(),
    },
    stderr: {
      stream: stdErrStream,
      writer: stdErrStream.getWriter(),
    },
    stdin: {
      stream: stdinStream,
      reader: stdinStream.getReader(),
    },
  };
};

/**
 * Generates test cases for a given variant of the CSE evaluator based on the provided TestCases object.
 * @param testCases The test cases to generate, organized by function name and consisting of tuples of [code, expected, output].
 * @param variant The variant of the CSE evaluator to test (e.g., 1 for Python §1)
 * @param groups The groups to load into the context before running the test cases (e.g., [`linkedList`, `list`]).
 */
export const generateTestCases = (testCases: TestCases, variant: number, groups: Group[]) => {
  for (const [funcName, tests] of Object.entries(testCases)) {
    describe(funcName, () => {
      afterEach(() => {
        jest.restoreAllMocks(); // Automatically restores all spyOn mocks
      });
      test.each(createInternalTestCases(tests))(
        `$code should return $label`,
        async ({ code, expected, output }) => {
          const spy = jest.spyOn(Stash.prototype, "pop");
          const context = new Context();

          const outputLst: OutputType[] = [];
          generateMockStreams(context, outputLst);
          const result = await runInContext(code, context, { variant, groups });
          expect(result).toBeDefined();
          expect(result.status).toBe("finished");

          if (typeof expected === "function" && expected.prototype instanceof RuntimeSourceError) {
            expect(context.errors).toHaveLength(1);
            expect(context.errors[0]).toHaveProperty("constructor", expected);
            return;
          }

          if (typeof expected === "function" && expected.prototype instanceof Error) {
            expect(result).toHaveProperty("value.message", expect.stringContaining(expected.name));
            return;
          }
          expect(result.status).not.toHaveProperty("value.type", "error");
          if (output !== null) {
            expect(outputLst).toEqual(output.map(line => ({ type: "stdout", value: line })));
          }

          if (expected === null) {
            expect(spy).toHaveLastReturnedWith(expect.objectContaining({ type: "none" }));
            return;
          }

          if (typeof expected === "bigint") {
            expect(spy).toHaveLastReturnedWith(
              expect.objectContaining({ type: "bigint", value: expected }),
            );
            return;
          }

          if (typeof expected === "number") {
            if (isNaN(expected)) {
              expect.objectContaining({ type: "number", value: NaN });
              return;
            }
            expect(spy).toHaveLastReturnedWith(
              expect.objectContaining({ type: "number", value: expect.closeTo(expected) }),
            );
            return;
          }

          if (typeof expected === "boolean") {
            expect(spy).toHaveLastReturnedWith(
              expect.objectContaining({ type: "bool", value: expected }),
            );
            return;
          }

          if (expected instanceof PyComplexNumber) {
            expect(spy).toHaveLastReturnedWith(
              expect.objectContaining({
                type: "complex",
                value: expect.objectContaining({
                  real: isNaN(expected.real) ? NaN : expect.closeTo(expected.real),
                  imag: isNaN(expected.imag) ? NaN : expect.closeTo(expected.imag),
                }),
              }),
            );
            return;
          }

          expect(spy).toHaveLastReturnedWith(
            expect.objectContaining({ type: "string", value: expected }),
          );
          return;
        },
      );
    });
  }
};

// ---------------------------------------------------------------------------
// SVML test utilities
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ErrorClass = new (...args: any[]) => Error;

/**
 * Expected value for an SVML test case.
 * SVML's toJSValue returns JS primitives directly, so no bigint or PyComplexNumber.
 * `undefined` means the expression should evaluate to Python None / no return value.
 */
export type SVMLTestExpectedValue = number | boolean | string | null | undefined | ErrorClass;

/**
 * Same shape as TestCases but with SVML-compatible expected values.
 * Each tuple: [code, expected, output].
 *   - expected: a JS primitive, undefined, null, or an Error subclass (for expected throws)
 *   - output: expected print outputs, or null if none expected
 */
export type SVMLTestCases = Record<string, [string, SVMLTestExpectedValue, string[] | null][]>;

export const generateSVMLTestCases = (testCases: SVMLTestCases) => {
  for (const [sectionName, tests] of Object.entries(testCases)) {
    describe(sectionName, () => {
      test.each(
        tests.map(([code, expected, output]) => ({
          code,
          expected,
          output,
          label: typeof expected === "function" ? expected.name : JSON.stringify(expected),
        })),
      )("$code → $label", ({ code, expected, output }) => {
        const source = code.endsWith("\n") ? code : code + "\n";
        if (typeof expected === "function") {
          expect(() => {
            const ast = parse(source);
            const program = SVMLCompiler.fromProgram(ast).compileProgram(ast);
            new SVMLInterpreter(program).execute();
          }).toThrow(expected);
          return;
        }

        const outputs: string[] = [];
        const ast = parse(source);
        const program = SVMLCompiler.fromProgram(ast).compileProgram(ast);
        const interpreter = new SVMLInterpreter(program, {
          sendOutput: msg => outputs.push(msg),
        });
        const result = SVMLInterpreter.toJSValue(interpreter.execute());

        if (expected === undefined) {
          expect(result).toBeUndefined();
        } else if (expected === null) {
          expect(result).toBeNull();
        } else if (typeof expected === "number" && !Number.isInteger(expected)) {
          expect(result).toBeCloseTo(expected);
        } else {
          expect(result).toBe(expected);
        }

        if (output !== null) {
          expect(outputs).toEqual(output);
        }
      });
    });
  }
};
