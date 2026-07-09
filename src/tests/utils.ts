import { execFileSync } from "node:child_process";
import path from "node:path";
import { ConductorError, ErrorType } from "@sourceacademy/conductor/common";
import { StmtNS } from "../ast-types";
import { Context } from "../engines/cse/context";
import { CSEResultPromise, evaluate, IOptions } from "../engines/cse/interpreter";
import { Stash, Value } from "../engines/cse/stash";
import { displayError } from "../engines/cse/streams";
import { PVMLCompiler } from "../engines/pvml/pvml-compiler";
import { PVMLInterpreter } from "../engines/pvml/pvml-interpreter";
import { RuntimeSourceError } from "../errors";
import { parse } from "../parser/parser-adapter";
import { Resolver } from "../resolver";
import { RunError } from "../runner";
import { runCodePvmlDetailed } from "../pvml-runner";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import { Group } from "../stdlib/utils";
import { PyComplexNumber, RecursivePartial, Result } from "../types";
import { FeatureNotSupportedError, makeValidatorsForChapter } from "../validator";
import { BreakContinueOutsideLoopError } from "../validator/types";
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
  const result = await evaluate(code, pyAst, context, options);
  return CSEResultPromise(context, result);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Class<T> = new (...args: any[]) => T;

export type TestOutputValue =
  | bigint
  | number
  | boolean
  | string
  | null
  | PyComplexNumber
  | TestOutputValue[];

export type TestErrorValue = Class<RuntimeSourceError> | Class<Error>;

export type TestExpectedValue = TestOutputValue | TestErrorValue;
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
  const resolver = new Resolver(script, ast, makeValidatorsForChapter(variant), [misc, math]);
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
      JSON.stringify(code) +
      " should " +
      (expected instanceof Function &&
      (expected.prototype instanceof RuntimeSourceError || expected.prototype instanceof Error)
        ? "throw " + expected.name
        : "return " + expected),
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
      test.each(createInternalTestCases(tests))(`$label`, async ({ code, expected, output }) => {
        const spy = jest.spyOn(Stash.prototype, "pop");
        const context = new Context();

        const outputLst: OutputType[] = [];
        generateMockStreams(context, outputLst);
        const result = await runInContext(code, context, { variant, groups });
        expect(result.status).toBe("finished");

        if (typeof expected === "function" && expected.prototype instanceof RuntimeSourceError) {
          expect(context.errors.length).toBeGreaterThan(0);
          expect(context.errors[0]).toHaveProperty("constructor", expected);
          return;
        }
        if (typeof expected === "function" && expected.prototype instanceof Error) {
          expect(result).toHaveProperty("value.message", expect.stringContaining(expected.name));
          return;
        }
        expect(outputLst.filter(item => item.type === "stderr")).toStrictEqual([]);

        expect(result.status).not.toHaveProperty("value.type", "error");
        if (output !== null) {
          expect(outputLst).toEqual(output.map(line => ({ type: "stdout", value: line + "\n" })));
        }

        const generateExpectedValueAssertion = (expected: TestOutputValue): Value => {
          if (expected === null) {
            return { type: "none" };
          }

          if (typeof expected === "bigint") {
            return { type: "bigint", value: expected };
          }

          if (typeof expected === "number") {
            if (isNaN(expected)) {
              return { type: "number", value: NaN };
            }
            return { type: "number", value: expect.closeTo(expected) };
          }

          if (typeof expected === "boolean") {
            return { type: "bool", value: expected };
          }

          if (expected instanceof PyComplexNumber) {
            return {
              type: "complex",
              value: expect.objectContaining({
                real: isNaN(expected.real) ? NaN : expect.closeTo(expected.real),
                imag: isNaN(expected.imag) ? NaN : expect.closeTo(expected.imag),
              }),
            };
          }

          if (Array.isArray(expected)) {
            return {
              type: "list",
              value: expected.map(generateExpectedValueAssertion),
            };
          }

          return { type: "string", value: expected };
        };
        expect(spy).toHaveLastReturnedWith(
          expect.objectContaining(generateExpectedValueAssertion(expected as TestOutputValue)),
        );
        return;
      });
    });
  }
};

// ---------------------------------------------------------------------------
// PVML test utilities
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ErrorClass = new (...args: any[]) => Error;

/**
 * Expected value for an PVML test case.
 * PVML's toJSValue returns JS primitives directly, so no bigint or PyComplexNumber.
 * `undefined` means the expression should evaluate to Python None / no return value.
 */
export type PVMLTestExpectedValue = number | boolean | string | null | undefined | ErrorClass;

/**
 * Same shape as TestCases but with PVML-compatible expected values.
 * Each tuple: [code, expected, output].
 *   - expected: a JS primitive, undefined, null, or an Error subclass (for expected throws)
 *   - output: expected print outputs, or null if none expected
 */
export type PVMLTestCases = Record<string, [string, PVMLTestExpectedValue, string[] | null][]>;

export const generatePVMLTestCases = (testCases: PVMLTestCases) => {
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
            const program = PVMLCompiler.fromProgram(ast).compileProgram(ast);
            new PVMLInterpreter(program).execute();
          }).toThrow(expected);
          return;
        }

        const outputs: string[] = [];
        const ast = parse(source);
        const program = PVMLCompiler.fromProgram(ast).compileProgram(ast);
        const interpreter = new PVMLInterpreter(program, {
          sendOutput: msg => outputs.push(msg),
        });
        const result = PVMLInterpreter.toJSValue(interpreter.execute());

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

// ---------------------------------------------------------------------------
// Native Pynter (pvml/pynter) parity test utilities
//
// Reruns the same `TestCases` tables used by generateTestCases() (the CSE
// suite) against the PVML compiler + a native Pynter `runner` binary, to
// track how far the pvml/pynter pathway currently is from CSE parity.
//
// Opt-in: set PYNTER_RUNNER_PATH to a built `runner` binary
// (https://github.com/source-academy/pynter#build-locally) to enable these.
// Skipped entirely otherwise, since CI doesn't build the native binary.
// Failures are expected and informative here, not a sign of broken infra —
// see README.md's "Running the standalone CLI (repl)" section for the
// pathway's known, current limitations.
// ---------------------------------------------------------------------------

/** Converts a Pynter result (type name + raw value string) to a JS value comparable to `expected`. */
function pynterResultToComparable(result: { resultType: string; resultValue: string }): unknown {
  switch (result.resultType) {
    case "integer":
    case "float":
      return Number(result.resultValue);
    case "boolean":
      return result.resultValue === "true";
    case "string":
      return result.resultValue;
    case "null":
      return null;
    case "undefined":
      return undefined;
    default:
      // arrays, functions: not decoded from the native trailer today.
      return undefined;
  }
}

/** Converts a CSE `TestOutputValue` to a JS value comparable to pynterResultToComparable()'s output. */
function expectedToComparable(expected: TestOutputValue): unknown {
  if (typeof expected === "bigint") {
    // Pynter numbers are single-precision floats/32-bit ints, not arbitrary-precision.
    return Number(expected);
  }
  if (
    typeof expected === "number" ||
    typeof expected === "string" ||
    typeof expected === "boolean" ||
    expected === null
  ) {
    return expected;
  }
  // PyComplexNumber and arrays aren't representable by the native result trailer today.
  return undefined;
}

/**
 * Compares a Pynter float result against the CSE (float64) reference value.
 * Pynter's floats are IEEE-754 single-precision, so the reference value must
 * be rounded to float32 before comparing — otherwise every comparison is
 * inflated by the fp64→fp32 rounding a *correct* Pynter would also incur.
 * The tolerance is relative to that rounded value's magnitude (a fixed
 * absolute tolerance is meaningless once a value exceeds a few thousand, and
 * too generous once it's near zero), with a generous ULP budget on top to
 * absorb rounding compounded across chained float32 arithmetic (loops,
 * transcendental functions) rather than a single operation.
 */
const FLOAT32_EPSILON = Math.pow(2, -23);
const FLOAT32_ULP_BUDGET = 4096;

export function isCloseToFloat32(actual: unknown, wanted: number): boolean {
  if (typeof actual !== "number") return false;
  if (Number.isNaN(wanted)) return Number.isNaN(actual);
  const rounded = Math.fround(wanted);
  if (!Number.isFinite(rounded)) return actual === rounded;
  const tolerance = FLOAT32_EPSILON * FLOAT32_ULP_BUDGET * Math.max(Math.abs(rounded), 1);
  return Math.abs(actual - rounded) <= tolerance;
}

/** Matches a Python imaginary-number literal: 3j, .5j, 1.2j, 1.j, 1e3j, 1e-3j, 1J, etc. */
const COMPLEX_LITERAL_RE = /(?<![a-zA-Z_])(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?[jJ]\b/;

/** Whether `expected` is (or, if an array, contains) a PyComplexNumber. */
function containsComplexNumber(expected: TestExpectedValue): boolean {
  if (expected instanceof PyComplexNumber) return true;
  if (Array.isArray(expected)) return expected.some(containsComplexNumber);
  return false;
}

/**
 * Whether a test case involves complex numbers, which Pynter's VM doesn't support
 * at all (it mirrors Sinter: values are booleans, 32-bit ints, or single-precision
 * floats only) — py-slang's own PVML compiler rejects complex literals outright
 * (see PVMLCompiler.visitComplexExpr). Detected via the expected value's type
 * (recursing into arrays, e.g. a list of complex numbers) or a complex-literal
 * regex over the source, since a case can involve complex numbers as an
 * intermediate value without one being the final `expected` result (e.g. a
 * comparison, or an error case).
 */
function involvesComplexNumbers(code: string, expected: TestExpectedValue): boolean {
  return containsComplexNumber(expected) || COMPLEX_LITERAL_RE.test(code);
}

/**
 * Matches a call to parse()/tokenize(): these turn SICPy source text into a
 * data structure for py-slang's own metacircular-evaluator feature (chapter
 * 4's stdlib/parser.ts). That's not a Python 3 language or library feature —
 * it has no meaningful analogue once a program is compiled to bytecode and
 * run on a VM like Pynter, so it's out of scope for parity here regardless
 * of Pynter's own capabilities.
 */
const PARSE_FEATURE_CALL_RE = /\b(?:parse|tokenize)\s*\(/;

function involvesParseFeature(code: string): boolean {
  return PARSE_FEATURE_CALL_RE.test(code);
}

/** Reasons a test case is skipped for the native Pynter pathway, checked in order. */
const NATIVE_PYNTER_SKIP_REASONS: {
  matches: (code: string, expected: TestExpectedValue) => boolean;
  reason: string;
}[] = [
  { matches: involvesComplexNumbers, reason: "Pynter does not support complex numbers" },
  {
    matches: code => involvesParseFeature(code),
    reason: "parse()/tokenize() aren't part of Python 3",
  },
];

/**
 * Reruns `testCases` (as already used with generateTestCases() for the CSE
 * machine) through the PVML compiler + native Pynter, at the given chapter
 * `variant`. See the file-level comment above for gating/expectations.
 *
 * `groups` overrides the default VARIANT_GROUPS[variant] stdlib groups,
 * matching whatever non-default combination the sibling generateTestCases()
 * call for the same suite uses (e.g. stream tests run CSE at variant 2 with
 * extra `stream`/`pairmutator` groups layered on).
 */
export const generateNativePynterTestCases = (
  testCases: TestCases,
  variant: number,
  groups?: Group[],
) => {
  // Pynter's target is Python (SICPy) §3 specifically (see pynter/README.md) —
  // every native-Pynter test case must be posed as a §3 program, regardless of
  // which chapter the sibling generateTestCases() call for the same suite uses.
  if (variant !== 3) {
    throw new Error(
      `generateNativePynterTestCases: Pynter only supports Python §3; got variant ${variant}.`,
    );
  }

  const pynterPath = process.env.PYNTER_RUNNER_PATH;
  const describeBlock = pynterPath ? describe : describe.skip;

  for (const [funcName, tests] of Object.entries(testCases)) {
    describeBlock(`[pvml/pynter] ${funcName}`, () => {
      const runTestCase = async ({ code, expected, output }: InternalTestCase) => {
        let result;
        try {
          result = await runCodePvmlDetailed(code, variant, { pynterPath: pynterPath!, groups });
        } catch (e) {
          if (typeof expected === "function") {
            // CSE also expects a failure here; any RunError counts as agreement.
            expect(e).toBeInstanceOf(RunError);
            return;
          }
          throw e;
        }

        if (typeof expected === "function") {
          throw new Error(
            `Expected an error (${expected.name}), but pvml/pynter completed with ` +
              `result type "${result.resultType}": ${result.resultValue}`,
          );
        }

        if (output !== null) {
          expect(result.output).toBe(output.map(line => `${line}\n`).join(""));
        }

        const actual = pynterResultToComparable(result);
        const wanted = expectedToComparable(expected);
        if (result.resultType === "float" && typeof wanted === "number") {
          expect(isCloseToFloat32(actual, wanted)).toBe(true);
        } else {
          expect(actual).toEqual(wanted);
        }
      };

      const internalTestCases = createInternalTestCases(tests);
      const supported: InternalTestCase[] = [];
      const skipBuckets = new Map<string, InternalTestCase[]>();
      for (const testCase of internalTestCases) {
        const reason = NATIVE_PYNTER_SKIP_REASONS.find(({ matches }) =>
          matches(testCase.code, testCase.expected),
        )?.reason;
        if (reason === undefined) {
          supported.push(testCase);
        } else {
          (skipBuckets.get(reason) ?? skipBuckets.set(reason, []).get(reason)!).push(testCase);
        }
      }

      // test.each throws if given an empty array, rather than registering zero
      // tests, so only call it for groups that actually have cases in each bucket.
      if (supported.length > 0) {
        test.each(supported)(`$label`, runTestCase);
      }
      for (const [reason, cases] of skipBuckets) {
        test.skip.each(cases)(`$label (${reason})`, runTestCase);
      }
    });
  }
};

// ---------------------------------------------------------------------------
// CPython parity test utilities (issue #224)
//
// Reruns the same `TestCases` tables used by generateTestCases() (the CSE
// suite) against real CPython + the `sourceacademy-sicp` package
// (python/sicp/), so that a program's *entire result*, not just the library's
// own pytest suite, is checked against the actual reference implementation
// students eventually run their code on. One persistent `python3` subprocess
// per describe block (scripts/cpython_batch_runner.py), fed every case as a
// single JSON batch — the suite has thousands of cases, so a process spawned
// per case would dominate the runtime.
//
// Opt-in: set CPYTHON_PATH to a `python3` binary (python/sicp/ is added to
// its sys.path by the runner script itself — no install needed). Skipped
// entirely otherwise, since CI doesn't have Python available by default.
//
// Unlike native-Pynter parity, a fair number of cases here are *expected* to
// disagree with CPython by design, not because a pathway is behind on a
// shared spec: Source Academy Python's own pedagogical restrictions (chapter-
// gated syntax, `is` restricted to reference types, bool excluded from
// arithmetic) have no CPython equivalent to compare against. Those are
// filtered by CPYTHON_SKIP_REASONS the same way native-Pynter skips things
// Pynter's VM can't do — the two lists barely overlap, since they're skipping
// for opposite reasons (CPython is *more* permissive than this dialect,
// Pynter is *less*). As with native-Pynter, failures that make it through the
// skip list are informative, not necessarily a sign of broken infra — see
// README.md.
// ---------------------------------------------------------------------------

const CPYTHON_BATCH_RUNNER = path.join(__dirname, "..", "..", "scripts", "cpython_batch_runner.py");

/** A JSON-number-unsafe float value, round-tripped through the batch runner as a tagged string
 * (JSON has no Infinity/NaN). */
type CPythonFloat = number | "nan" | "inf" | "-inf";

type CPythonValue =
  | { type: "none" }
  | { type: "bool"; value: boolean }
  | { type: "int"; value: string }
  | { type: "float"; value: CPythonFloat }
  | { type: "complex"; value: { real: CPythonFloat; imag: CPythonFloat } }
  | { type: "str"; value: string }
  | { type: "list"; value: CPythonValue[] }
  | { type: "other"; repr: string };

interface CPythonCaseResult {
  id: string;
  output: string[];
  error: string | null;
  result: CPythonValue | null;
}

/** Runs `cases` through scripts/cpython_batch_runner.py in one subprocess, keyed by id. Throws if
 * the runner itself couldn't execute (missing python3, sicp/ not importable, ...) — an individual
 * case's own Python-level error is captured in its own result, not thrown here. */
function runCPythonBatch(
  pythonPath: string,
  cases: { id: string; code: string }[],
): Map<string, CPythonCaseResult> {
  const stdout = execFileSync(pythonPath, [CPYTHON_BATCH_RUNNER], {
    input: JSON.stringify(cases),
    encoding: "utf-8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const results = JSON.parse(stdout) as CPythonCaseResult[];
  return new Map(results.map(r => [r.id, r]));
}

function floatToComparable(n: number): CPythonFloat {
  if (Number.isNaN(n)) return "nan";
  if (n === Infinity) return "inf";
  if (n === -Infinity) return "-inf";
  return n;
}

/** Converts a CSE `TestOutputValue` to a value comparable with the batch runner's serialized
 * result shape (same tagged-union shape on both sides). Unlike native-Pynter's
 * expectedToComparable(), this needs no float32 rounding or complex-number exclusion — CPython has
 * real doubles and real complex numbers, matching the CSE machine's own value model closely.
 * `undefined` for a value the runner can't/doesn't decode (functions, etc.), same fallback
 * native-Pynter's version uses. */
function cpythonExpectedToComparable(expected: TestOutputValue): CPythonValue | undefined {
  if (typeof expected === "bigint") return { type: "int", value: expected.toString() };
  if (typeof expected === "number") return { type: "float", value: floatToComparable(expected) };
  if (typeof expected === "boolean") return { type: "bool", value: expected };
  if (typeof expected === "string") return { type: "str", value: expected };
  if (expected === null) return { type: "none" };
  if (expected instanceof PyComplexNumber) {
    return {
      type: "complex",
      value: {
        real: floatToComparable(expected.real),
        imag: floatToComparable(expected.imag),
      },
    };
  }
  if (Array.isArray(expected)) {
    const values = expected.map(cpythonExpectedToComparable);
    if (values.some(v => v === undefined)) return undefined;
    return { type: "list", value: values as CPythonValue[] };
  }
  return undefined;
}

/** Whether `expected` is a resolve-time chapter-gating restriction (a Python §<N> feature not
 * being available yet — lists, `is`, loops, lambda, ... at an earlier chapter): purely a Source
 * Academy Python pedagogical device with no CPython concept to compare against, since CPython has
 * no notion of "chapter" at all — every one of these is valid CPython syntax regardless of which
 * py-slang chapter validator is active. */
function isChapterGatingError(expected: TestExpectedValue): boolean {
  return (
    typeof expected === "function" &&
    (expected.prototype instanceof FeatureNotSupportedError ||
      expected === FeatureNotSupportedError ||
      expected.prototype instanceof BreakContinueOutsideLoopError ||
      expected === BreakContinueOutsideLoopError)
  );
}

/**
 * Whether `code` is a call whose entire argument list is `True`/`False` and `expected` is an
 * error: unlike CPython (where `bool` is an `int` subclass, so e.g. `abs(True) == 1`), this
 * dialect deliberately excludes `bool` from every arithmetic/numeric builtin and operator (see
 * `asIntIfBool`'s doc comment in operators.ts and the equivalent restriction across misc.ts/
 * math.ts) — a pedagogical rule with no CPython equivalent, not a bug. High-volume: nearly every
 * numeric builtin has one of these cases, so left unfiltered it would swamp genuinely interesting
 * failures.
 */
const BOOL_REJECTION_CALL_RE = /^\w+\((?:True|False)(?:,\s*(?:True|False))*\)$/;

function isBoolRejection(code: string, expected: TestExpectedValue): boolean {
  return typeof expected === "function" && BOOL_REJECTION_CALL_RE.test(code.trim());
}

/**
 * Matches a `while` loop whose condition is a bare non-comparison expression (a literal or an
 * arithmetic/variable expression, with no comparison/boolean operator) -- e.g. `while 1:`,
 * `while None:`, `while y + 1:`, but not `while i < 5:`. This dialect requires while-conditions to
 * be exactly `bool`, unlike CPython's normal truthy/falsy semantics -- a pedagogical restriction
 * with no CPython equivalent, like `isBoolRejection` above. Critical to skip, not just cosmetic:
 * some of these (`while 1:`, `while y + 1:`) are genuine infinite loops under real CPython, since
 * py-slang's error fires before the loop body ever runs but CPython has nothing to stop it -- left
 * unfiltered, this hangs the whole batch runner (see issue #224 test-mode hang investigation).
 */
const WHILE_CONDITION_RE = /\bwhile\s+([^:\n]+):/;
const COMPARISON_OR_BOOLEAN_OP_RE = /==|!=|<=|>=|<|>|\bin\b|\bis\b|\bnot\b|\band\b|\bor\b/;

function isWhileNonBoolCondition(code: string, expected: TestExpectedValue): boolean {
  if (typeof expected !== "function") return false;
  const match = code.match(WHILE_CONDITION_RE);
  return match !== null && !COMPARISON_OR_BOOLEAN_OP_RE.test(match[1]);
}

/** Reasons a test case is skipped for the CPython pathway, checked in order. */
const CPYTHON_SKIP_REASONS: {
  matches: (code: string, expected: TestExpectedValue) => boolean;
  reason: string;
}[] = [
  {
    matches: isBoolRejection,
    reason: "bool is an int subclass in CPython, unlike this dialect's arithmetic/numeric builtins",
  },
  {
    matches: isWhileNonBoolCondition,
    reason:
      "while-conditions must be exactly bool in this dialect, unlike CPython's truthy/falsy " +
      "semantics -- some of these are genuine infinite loops under CPython",
  },
  {
    matches: (_code, expected) => isChapterGatingError(expected),
    reason: "chapter-gating is a Source Academy Python concept CPython has no equivalent of",
  },
  {
    matches: code => involvesParseFeature(code),
    reason: "parse()/tokenize() aren't part of Python 3 (sicp.mce has no equivalent)",
  },
];

/**
 * Reruns `testCases` (as already used with generateTestCases() for the CSE machine) through real
 * CPython, at the given chapter `variant`. See the file-level comment above for gating and
 * expectations.
 *
 * `groups` overrides the default VARIANT_GROUPS[variant] stdlib groups, matching whatever
 * non-default combination the sibling generateTestCases() call for the same suite uses.
 */
export const generateCPythonTestCases = (
  testCases: TestCases,
  variant: number,
  groups?: Group[],
) => {
  void variant; // Not needed by the runner itself (sicp exposes the full superset of builtins
  // unconditionally); kept as a parameter so call sites read the same as generateTestCases()'s.
  void groups; // Same: sicp has no notion of "this group isn't loaded yet", so nothing to pass on.

  const pythonPath = process.env.CPYTHON_PATH;
  const describeBlock = pythonPath ? describe : describe.skip;

  for (const [funcName, tests] of Object.entries(testCases)) {
    describeBlock(`[cpython] ${funcName}`, () => {
      const internalTestCases = createInternalTestCases(tests);
      const supported: InternalTestCase[] = [];
      const skipBuckets = new Map<string, InternalTestCase[]>();
      for (const testCase of internalTestCases) {
        const reason = CPYTHON_SKIP_REASONS.find(({ matches }) =>
          matches(testCase.code, testCase.expected),
        )?.reason;
        if (reason === undefined) {
          supported.push(testCase);
        } else {
          (skipBuckets.get(reason) ?? skipBuckets.set(reason, []).get(reason)!).push(testCase);
        }
      }

      let batchResults: Map<string, CPythonCaseResult> = new Map();
      if (pythonPath && supported.length > 0) {
        beforeAll(() => {
          batchResults = runCPythonBatch(
            pythonPath,
            supported.map((c, i) => ({ id: String(i), code: c.code })),
          );
        });
      }

      const runTestCase = (testCase: InternalTestCase, index: number) => {
        const { expected, output } = testCase;
        const result = batchResults.get(String(index));
        if (!result) throw new Error("CPython batch result missing for this case");

        if (typeof expected === "function") {
          // CSE also expects a failure here; any CPython exception counts as agreement — exact
          // exception class/message parity isn't the point (py-slang's own error names, like
          // MissingRequiredPositionalError, don't exist in CPython).
          expect(result.error).not.toBeNull();
          return;
        }

        expect(result.error).toBeNull();
        if (output !== null) {
          expect(result.output).toEqual(output);
        }

        const wanted = cpythonExpectedToComparable(expected as TestOutputValue);
        if (wanted === undefined || result.result === undefined) return; // not decodable; skip value check
        if (wanted.type === "float" && result.result?.type === "float") {
          const a = result.result.value;
          const w = wanted.value;
          if (typeof a === "number" && typeof w === "number") {
            expect(a).toBeCloseTo(w);
            return;
          }
        }
        if (wanted.type === "complex" && result.result?.type === "complex") {
          const aReal = result.result.value.real;
          const aImag = result.result.value.imag;
          const wReal = wanted.value.real;
          const wImag = wanted.value.imag;
          if (
            typeof aReal === "number" &&
            typeof wReal === "number" &&
            typeof aImag === "number" &&
            typeof wImag === "number"
          ) {
            expect(aReal).toBeCloseTo(wReal);
            expect(aImag).toBeCloseTo(wImag);
            return;
          }
        }
        expect(result.result).toEqual(wanted);
      };

      if (supported.length > 0) {
        test.each(supported.map((c, i) => ({ ...c, __index: i })))(
          `$label`,
          ({ __index, ...testCase }) => runTestCase(testCase, __index),
        );
      }
      for (const [reason, cases] of skipBuckets) {
        test.skip.each(cases)(`$label (${reason})`, () => {});
      }
    });
  }
};
