import { ConductorError, ErrorType } from "@sourceacademy/conductor/common";
import { ExprNS, StmtNS } from "../ast-types";
import { Context } from "../engines/cse/context";
import { CSEResultPromise, evaluate, IOptions } from "../engines/cse/interpreter";
import { Stash, Value } from "../engines/cse/stash";
import { displayError } from "../engines/cse/streams";
import { PVMLCompiler } from "../engines/pvml/pvml-compiler";
import { PVMLInterpreter } from "../engines/pvml/pvml-interpreter";
import { PVMLBoxType } from "../engines/pvml/types";
import { RuntimeSourceError } from "../errors";
import { parse } from "../parser/parser-adapter";
import { analyzeWithEnvironments, Resolver } from "../resolver";
import { RunError, VARIANT_GROUPS } from "../runner";
import { runCodePvmlDetailed } from "../pvml-runner";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import { Group, toPythonFloat, toPythonString } from "../stdlib/utils";
import { Token, TokenType } from "../tokenizer";
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
      setNextPrompt: () => {},
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
 * Marks a whole-number PVMLTestExpectedValue as a Python float, not an int
 * (e.g. `asFloat(180)` for `math_degrees(math_pi) == 180.0`, not `180`) —
 * needed because a plain whole-number `number` here means int by default
 * (this table's own long-established convention: `["1 + 1", 2, null]` means
 * the bigint `2n`, not the float `2.0`), and JS's `Number.isInteger(180)`
 * can't otherwise tell "180" and "180.0" apart to know when that default is
 * wrong. Real Python's own math module has plenty of these: `math_fmod`,
 * `math_remainder`, `math_copysign`, `math_ldexp`, `math_exp2`, `math_gamma`,
 * `math_degrees`, `math_erf`/`math_erfc`, `math_fabs` all return float even
 * for whole-number inputs/outputs, verified against real CPython.
 */
class PyFloatMarker {
  constructor(public readonly value: number) {}
}
export function asFloat(value: number): PyFloatMarker {
  return new PyFloatMarker(value);
}

/**
 * Expected value for an PVML test case.
 * Python `int` results come back from toJSValue as a genuine JS `bigint`
 * (see PVMLType.BIGINT) — expressed here as a plain `number` for test-table
 * brevity; runTestCase() below compares a bigint result against it by value
 * (`Number(result) === expected`), not by `toBe`/`Object.is`. A whole-number
 * float result (as opposed to this dialect's own int-returning arithmetic)
 * needs `asFloat(...)` instead — see its doc comment above — a fractional
 * `number` (e.g. `3.14`) is unambiguous and needs no wrapper. Complex-valued
 * results have no dedicated variant here either — assert them via str()
 * (e.g. `["str(1+2j)", "(1+2j)", null]`), same idea.
 * `undefined` means "don't check a result value at all" (e.g. the program's
 * last statement isn't an expression, or is already an explicit print()
 * call whose own return value isn't the point) — for Python `None` itself,
 * use `null`.
 */
export type PVMLTestExpectedValue =
  | number
  | boolean
  | string
  | null
  | undefined
  | ErrorClass
  | PyFloatMarker;

/**
 * Same shape as TestCases but with PVML-compatible expected values.
 * Each tuple: [code, expected, output].
 *   - expected: a JS primitive, undefined, null, or an Error subclass (for expected throws)
 *   - output: expected print outputs, or null if none expected
 */
export type PVMLTestCases = Record<string, [string, PVMLTestExpectedValue, string[] | null][]>;

/** Reasons a test case is skipped for the PVML compiler + PVMLInterpreter pathway,
 * checked in order — mirrors NATIVE_PYNTER_SKIP_REASONS below, for the same
 * reason: a case that's genuinely out of this pathway's scope should be a
 * labeled skip, not a failure someone has to keep re-diagnosing as "known".
 * Currently empty: parse()/tokenize()/apply_in_underlying_python() are all
 * wired up (see builtins.ts) — PARSE_FEATURE_CALL_RE below is only used by
 * NATIVE_PYNTER_SKIP_REASONS now, native Pynter being the pathway that
 * genuinely still doesn't (and won't) support them. */
const PVML_SKIP_REASONS: {
  matches: (code: string) => boolean;
  reason: string;
}[] = [];

/**
 * @param variant The Python chapter to compile test cases for (default 4, the
 * broadest — matches PyPvmlEvaluator's own hardcoded chapter). Matters both
 * for chapter-gated operator semantics (`==`/`!=`/ordering's bool handling,
 * `is`/`is not`) and for which chapter's validators (NoListsValidator,
 * NoIsOperatorValidator, ...) apply during resolution.
 * @param groups Stdlib groups to load — same as generateTestCases()'s
 * `groups` param. Defaults to `[misc, math]` (this pathway's own previous,
 * implicit default) rather than `[]`, so existing callers that don't
 * override it keep seeing `print`/etc. Each group's SICPy prelude (if any)
 * is compiled and run once per test case, into the same PVMLInterpreter
 * globalEnv the case itself then runs against (PVMLCompiler's `useGlobalMap`
 * mode — see its doc comment), so prelude-defined functions (e.g.
 * `pair`/`head` from linkedList) are callable from the case. Each case gets
 * a *fresh* globalEnv — unlike PyPvmlEvaluator's REPL semantics, cases here
 * are independent of one another, matching generateTestCases()/
 * generateNativePynterTestCases().
 */
/**
 * A Python script has no return value of its own (see pvml-compiler.ts's
 * visitFileInputStmt doc comment) — PVMLInterpreter.execute() always yields
 * `undefined`. To let this test harness still check "what did the last
 * expression evaluate to", it uses the same technique a real Python program
 * would (and the exact one used elsewhere in this file's own generatePVMLTestCases
 * call sites): print() the expression. If the program's last top-level
 * statement is a bare expression, this rewrites it (in the already-parsed
 * AST, not by re-serializing/re-parsing source text, so an expression with
 * its own side effects is evaluated exactly once) into `print(<that
 * expression>)`, and the last captured output line is compared against
 * `expected`'s Python str() form — see expectedToPythonStr below. Requires
 * `print` to be resolvable (i.e. the `misc` group, in scope for every
 * generatePVMLTestCases call site below).
 */
function wrapLastExpressionInPrint(ast: StmtNS.FileInput): boolean {
  const last = ast.statements[ast.statements.length - 1];
  if (!(last instanceof StmtNS.SimpleExpr)) return false;
  const token = new Token(TokenType.NAME, "print", last.startToken.line, 0, -1);
  token.synthetic = true;
  const printCallee = new ExprNS.Variable(token, token, token);
  const call = new ExprNS.Call(last.startToken, last.endToken, printCallee, [last.expression]);
  ast.statements[ast.statements.length - 1] = new StmtNS.SimpleExpr(
    last.startToken,
    last.endToken,
    call,
  );
  return true;
}

/**
 * The exact string print()/str() would produce for a PVMLTestExpectedValue
 * (excluding the ErrorClass case, handled separately by a throw check) —
 * compared against captured print() output. `number` is ambiguous between a
 * Python int and float (unlike CSE's own TestOutputValue, which has a
 * separate bigint case): a whole-number `number` is presumed to mean an int
 * result (e.g. `5` -> `"5"`) since that's this dialect's more common case,
 * not a fact this function can know for certain — a case where the actual
 * result is a float (e.g. math_remainder, which always returns float in
 * real Python even for int inputs) needs its own table entry using a
 * non-integer-shaped expectation, or gets caught and corrected the same way
 * pvml-interpreter.test.ts's math_remainder/math_ldexp cases were: run it,
 * see what it actually prints, verify against real CPython, fix the table.
 */
function expectedToPythonStr(expected: number | boolean | string | null): string {
  if (expected === null) return "None";
  if (typeof expected === "boolean") return expected ? "True" : "False";
  if (typeof expected === "string") return expected;
  if (Number.isInteger(expected)) return String(expected);
  return toPythonFloat(expected);
}

export const generatePVMLTestCases = (
  testCases: PVMLTestCases,
  variant: number = 4,
  groups: Group[] = [misc, math],
) => {
  const preludeText = groups
    .map(g => g.prelude ?? "")
    .filter(p => p.trim())
    .join("\n");

  /** Runs `script` against `globalEnv` (mutated in place). `capturedResult` is the printed text
   * from wrapLastExpressionInPrint's auto-wrap (popped off `outputs` before returning, so it
   * doesn't get mixed up with the code's own explicit print() calls) — `undefined` if the script's
   * last statement wasn't a bare expression, i.e. nothing to capture. Compiles+resolves fresh each
   * call, using whatever names are already in `globalEnv` (from an earlier call with the same map,
   * e.g. the prelude) so this script can reference them. */
  const runAgainstGlobalEnv = (
    script: string,
    globalEnv: Map<string, PVMLBoxType>,
    wantsCapture: boolean = false,
  ): { capturedResult: string | undefined; outputs: string[] } => {
    const source = script.endsWith("\n") ? script : script + "\n";
    const ast = parse(source);
    // Only auto-wrap when the test case actually wants to observe a result
    // (expected !== undefined) -- a case with expected: undefined isn't
    // necessarily "the last statement isn't an expression" (e.g. a bare
    // `print("hello")` call as the whole program *is* a SimpleExpr, but
    // wrapping it again would double-call print, printing "None" for the
    // inner call's own None return value instead of "hello").
    const wrapped = wantsCapture && wrapLastExpressionInPrint(ast);
    const { errors, environments } = analyzeWithEnvironments(
      ast,
      source,
      variant,
      groups,
      [],
      Array.from(globalEnv.keys()),
    );
    if (errors.length > 0) {
      throw errors[0];
    }
    const compiler = PVMLCompiler.fromProgram(ast, variant, environments, true);
    const program = compiler.compileProgram(ast);
    const outputs: string[] = [];
    const interpreter = new PVMLInterpreter(program, {
      sendOutput: msg => outputs.push(msg),
      globalEnv,
    });
    interpreter.execute();
    const capturedResult = wrapped ? outputs.pop() : undefined;
    return { capturedResult, outputs };
  };

  type PVMLInternalCase = {
    code: string;
    expected: PVMLTestExpectedValue;
    output: string[] | null;
    label: string;
  };

  const runTestCase = ({ code, expected, output }: PVMLInternalCase) => {
    const globalEnv = new Map<string, PVMLBoxType>();
    if (preludeText.trim()) {
      runAgainstGlobalEnv(preludeText, globalEnv);
    }

    if (typeof expected === "function") {
      expect(() => runAgainstGlobalEnv(code, globalEnv)).toThrow(expected);
      return;
    }

    const { capturedResult, outputs } = runAgainstGlobalEnv(
      code,
      globalEnv,
      expected !== undefined,
    );

    if (expected === undefined) {
      expect(capturedResult).toBeUndefined();
    } else if (
      expected instanceof PyFloatMarker ||
      (typeof expected === "number" && !Number.isInteger(expected))
    ) {
      // Genuine floating-point computation (log, gamma, sqrt, ...) can legitimately differ in
      // the last ULP depending on computation order/platform -- exact string comparison is too
      // strict here, unlike the int/bool/string/None cases below, which have no such ambiguity.
      const wanted = expected instanceof PyFloatMarker ? expected.value : expected;
      expect(Number(capturedResult)).toBeCloseTo(wanted);
    } else {
      expect(capturedResult).toBe(expectedToPythonStr(expected));
    }

    if (output !== null) {
      expect(outputs).toEqual(output);
    }
  };

  for (const [sectionName, tests] of Object.entries(testCases)) {
    describe(sectionName, () => {
      const internalCases: PVMLInternalCase[] = tests.map(([code, expected, output]) => ({
        code,
        expected,
        output,
        label:
          typeof expected === "function"
            ? expected.name
            : expected instanceof PyFloatMarker
              ? `${expected.value}.0`
              : JSON.stringify(expected),
      }));

      const supported: PVMLInternalCase[] = [];
      const skipBuckets = new Map<string, PVMLInternalCase[]>();
      for (const testCase of internalCases) {
        const reason = PVML_SKIP_REASONS.find(({ matches }) => matches(testCase.code))?.reason;
        if (reason === undefined) {
          supported.push(testCase);
        } else {
          (skipBuckets.get(reason) ?? skipBuckets.set(reason, []).get(reason)!).push(testCase);
        }
      }

      // test.each throws if given an empty array, rather than registering zero
      // tests, so only call it for groups that actually have cases in each bucket.
      if (supported.length > 0) {
        test.each(supported)("$code → $label", runTestCase);
      }
      for (const [reason, cases] of skipBuckets) {
        test.skip.each(cases)(`$code → $label (${reason})`, runTestCase);
      }
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
// PVML-in-browser parity test utilities
//
// Reruns the same `TestCases` tables already used with generateTestCases()
// (the CSE machine) and generateNativePynterTestCases() (native Pynter)
// against the PVML compiler + PVMLInterpreter — the pure-TypeScript
// "PVML-in-browser" VM (see pvml-runner.ts's runCodePvmlInterpreterDetailed).
// No native binary is involved, so — unlike generateNativePynterTestCases,
// gated behind PYNTER_RUNNER_PATH — this runs unconditionally. Unlike native
// Pynter (§3 only, see runCodePvmlDetailed's doc comment), the in-browser
// interpreter supports all four SICPy chapters, so `variant` is a required
// parameter here, matching generateTestCases()'s own signature, rather than
// hardcoded to 3 — callers should pass the same variant as their sibling
// generateTestCases() call for the same table.
// ---------------------------------------------------------------------------

/**
 * Whether `expr` is a bare call to `print`/`display` (both the same
 * primitive — see builtins.ts's PRIMITIVE_FUNCTIONS, index 5). A shared
 * TestCases table entry occasionally already ends in one of these itself
 * (e.g. parser-stdlib.test.ts's `'print(parse("42"))'`, printing a parsed
 * data structure as its own way of observing it), with `expected: null` for
 * that call's own (always-None) return value — the auto-wrap below must not
 * wrap such a case again (`print(print(...))`), or it would print an extra
 * "None" line and corrupt the `output` assertion.
 */
function isBarePrintCall(expr: ExprNS.Expr): boolean {
  return (
    expr instanceof ExprNS.Call &&
    expr.callee instanceof ExprNS.Variable &&
    (expr.callee.name.lexeme === "print" || expr.callee.name.lexeme === "display")
  );
}

/**
 * Converts a TestOutputValue (see TestCases' own doc comment) into a CSE
 * `Value`, so it can be rendered with the exact same toPythonString() the
 * PVML print() builtin itself uses (see builtins.ts case 5) — comparing the
 * two engines' output through one shared formatter, rather than a second
 * hand-written one that could drift from either.
 */
function testOutputValueToCseValue(v: TestOutputValue): Value {
  if (v === null) return { type: "none" };
  if (typeof v === "bigint") return { type: "bigint", value: v };
  if (typeof v === "number") return { type: "number", value: v };
  if (typeof v === "boolean") return { type: "bool", value: v };
  if (typeof v === "string") return { type: "string", value: v };
  if (v instanceof PyComplexNumber) return { type: "complex", value: v };
  return { type: "list", value: v.map(testOutputValueToCseValue) };
}

/**
 * Reruns `testCases` through the PVML compiler + PVMLInterpreter (in-browser),
 * at the given chapter `variant`. A Python script has no return value of its
 * own (see pvml-compiler.ts's visitFileInputStmt doc comment), so — exactly
 * as generatePVMLTestCases and operator-conformance-pvml.test.ts already do
 * — a case's last bare-expression statement is rewritten (in the parsed AST,
 * not by re-serializing source, so a side-effecting expression still runs
 * only once) into `print(<that expression>)`, unless it's already a bare
 * print()/display() call (see isBarePrintCall, whose own return is always
 * None). Captured output is then compared, as text, against `expected`
 * rendered through the very same toPythonString() PVML's own print()
 * builtin uses.
 *
 * `bigint`/`bool`/`string`/`null`/`list` expected values are compared
 * exactly — this dialect's ints are arbitrary-precision (LGCBI, not a
 * float-precision-limited encoding) and every other case has no
 * floating-point imprecision to account for. A top-level `number` (always a
 * Python float here — a whole-number *int* result uses TestOutputValue's
 * `bigint` variant instead) is compared with `toBeCloseTo` rather than exact
 * text, and a `complex` result's real/imag parts likewise: a math builtin
 * (or complex arithmetic itself) needing its own numerical approximation
 * (gamma, erf, ...) can differ from CSE's own implementation in the last ULP
 * without either being wrong — matching the tolerance generateTestCases()
 * already applies to these same table entries (see its own `expect.closeTo`
 * on both `number` and `complex`'s `real`/`imag`).
 *
 * `groups` overrides the default VARIANT_GROUPS[variant] stdlib groups,
 * matching whatever non-default combination the sibling generateTestCases()/
 * generateNativePynterTestCases() call for the same suite uses (e.g. stream
 * tests add `stream`/`pairmutator` groups on top). Each group's prelude is
 * compiled and run once per test case into a *fresh* globalEnv — mirroring
 * generatePVMLTestCases' own per-case prelude handling — so prelude-defined
 * functions (e.g. `equal`/`map`/`reverse` from linkedList) are callable from
 * the case, with no state leaking between cases.
 */
export const generatePvmlInBrowserTestCases = (
  testCases: TestCases,
  variant: number,
  groups?: Group[],
) => {
  const resolvedGroups = groups ?? VARIANT_GROUPS[variant];
  if (!resolvedGroups) {
    throw new Error(`generatePvmlInBrowserTestCases: invalid variant ${variant}. Expected 1-4.`);
  }
  const preludeText = resolvedGroups
    .map(g => g.prelude ?? "")
    .filter(p => p.trim())
    .join("\n");

  /** Compiles+runs `script` fresh against `globalEnv` (mutated in place),
   * using whatever names are already in it (e.g. from an earlier prelude
   * run). Mirrors generatePVMLTestCases' own runAgainstGlobalEnv, plus the
   * isBarePrintCall double-wrap guard described above. */
  const runAgainstGlobalEnv = (
    script: string,
    globalEnv: Map<string, PVMLBoxType>,
    wantsCapture: boolean = false,
  ): { capturedResult: string | undefined; outputs: string[] } => {
    const source = script.endsWith("\n") ? script : script + "\n";
    const ast = parse(source);
    const last = ast.statements[ast.statements.length - 1];
    const alreadyPrints = last instanceof StmtNS.SimpleExpr && isBarePrintCall(last.expression);
    const wrapped = wantsCapture && !alreadyPrints && wrapLastExpressionInPrint(ast);
    const { errors, environments } = analyzeWithEnvironments(
      ast,
      source,
      variant,
      resolvedGroups,
      [],
      Array.from(globalEnv.keys()),
    );
    if (errors.length > 0) {
      throw errors[0];
    }
    const compiler = PVMLCompiler.fromProgram(ast, variant, environments, true);
    const program = compiler.compileProgram(ast);
    const outputs: string[] = [];
    const interpreter = new PVMLInterpreter(program, {
      sendOutput: msg => outputs.push(msg),
      globalEnv,
    });
    interpreter.execute();
    const capturedResult = wrapped
      ? outputs.pop()
      : wantsCapture && alreadyPrints
        ? "None"
        : undefined;
    return { capturedResult, outputs };
  };

  const runTestCase = ({ code, expected, output }: InternalTestCase) => {
    const globalEnv = new Map<string, PVMLBoxType>();
    if (preludeText.trim()) {
      runAgainstGlobalEnv(preludeText, globalEnv);
    }

    if (typeof expected === "function") {
      expect(() => runAgainstGlobalEnv(code, globalEnv)).toThrow();
      return;
    }

    const { capturedResult, outputs } = runAgainstGlobalEnv(code, globalEnv, true);

    if (output !== null) {
      expect(outputs).toEqual(output);
    }

    if (typeof expected === "number") {
      expect(Number(capturedResult)).toBeCloseTo(expected);
    } else if (expected instanceof PyComplexNumber) {
      // Complex arithmetic is genuine floating-point computation too (not a
      // fixed-precision encoding like bigint/bool/string/None) — real/imag
      // parts get the same toBeCloseTo tolerance as a top-level `number`
      // above, matching the tolerance generateTestCases() itself already
      // applies to these same table entries (see its own `expect.closeTo`
      // on `real`/`imag`). toPythonString()'s complex format wraps
      // non-zero-real values in parens (see PyComplexNumber.toString()),
      // which fromString() doesn't accept back, so strip them first.
      const parsed = PyComplexNumber.fromString((capturedResult ?? "").replace(/^\(|\)$/g, ""));
      expect(parsed.real).toBeCloseTo(expected.real);
      expect(parsed.imag).toBeCloseTo(expected.imag);
    } else {
      expect(capturedResult).toBe(toPythonString(testOutputValueToCseValue(expected)));
    }
  };

  for (const [funcName, tests] of Object.entries(testCases)) {
    describe(`[pvml-in-browser] ${funcName}`, () => {
      test.each(createInternalTestCases(tests))(`$label`, runTestCase);
    });
  }
};
