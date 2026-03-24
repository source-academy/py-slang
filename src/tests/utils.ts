import { expect, test } from "@jest/globals";

import { Tokenizer } from "../tokenizer";
import { Parser } from "../parser";
import { Resolver } from "../resolver";
// import {Translator} from '../translator';
import { StmtNS } from "../ast-types";
import Stmt = StmtNS.Stmt;
import { Context } from "../cse-machine/context";
import { runInContext } from "../runner/pyRunner";
import { Group } from "../stdlib/utils";
import { RuntimeSourceError } from "../errors";
import { PyComplexNumber } from "../types";
import { executionAsyncId } from "async_hooks";

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
 * - code is the code to be executed
 * - expected is the expected value of the expression, which can be a primitive value, null (for None), or an error class (for expected errors)
 * - output is the expected output to be printed to the console, or null if no output is expected
 */
export type TestCases = Record<string, [string, TestExpectedValue, string | null][]>;

export function toPythonAst(text: string): Stmt {
  const script = text + "\n";
  const tokenizer = new Tokenizer(script);
  const tokens = tokenizer.scanEverything();
  const pyParser = new Parser(script, tokens);
  const ast = pyParser.parse();
  // console.dir(ast);
  return ast;
}

export function toPythonAstAndResolve(text: string, chapter: number): Stmt {
  const ast = toPythonAst(text);
  new Resolver(text, ast, chapter).resolve(ast);
  return ast;
}

// export function toEstreeAST(text: string): Expression | Statement {
//     const ast = toPythonAst(text);
//     return new Translator(text).resolve(ast);
// }

// export function toEstreeAstAndResolve(text: string): Expression | Statement {
//     const ast = toPythonAst(text);
//     new Resolver(text, ast).resolve(ast);
//     return new Translator(text).resolve(ast);
// }
type InternalTestCase = {
  label: TestExpectedValue;
  code: string;
  expected: TestExpectedValue;
  output: string | null;
};

export const createInternalTestCases = (
  tests: [string, TestExpectedValue, string | null][],
): InternalTestCase[] => {
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

export const generateTestCases = (testCases: TestCases, variant: number, groups: Group[]) => {
  for (const [funcName, tests] of Object.entries(testCases)) {
    describe(funcName, () => {
      test.concurrent.each(createInternalTestCases(tests))(
        `$code should return $label`,
        async ({ code, expected, output }) => {
          const context = new Context();
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
            expect(context.output).toBe(output);
          }

          if (expected === null) {
            expect(context.stash.peek()).toHaveProperty("type", "none");
            return;
          }

          if (typeof expected === "bigint") {
            expect(context.stash.peek()).toHaveProperty("type", "bigint");
            expect(context.stash.peek()).toHaveProperty("value", expected);
            return;
          }

          if (typeof expected === "number") {
            expect(context.stash.peek()).toHaveProperty("type", "number");
            expect(context.stash.peek()).toHaveProperty("value", expect.closeTo(expected));
            return;
          }

          if (typeof expected === "boolean") {
            expect(context.stash.peek()).toHaveProperty("type", "bool");
            expect(context.stash.peek()).toHaveProperty("value", expected);
            return;
          }

          if (expected instanceof PyComplexNumber) {
            expect(context.stash.peek()).toHaveProperty("type", "complex");
            expect(context.stash.peek()).toHaveProperty(
              "value.real",
              expect.closeTo(expected.real),
            );
            expect(context.stash.peek()).toHaveProperty(
              "value.imag",
              expect.closeTo(expected.imag),
            );
            return;
          }

          expect(context.stash.peek()).toHaveProperty("type", "string");
          expect(context.stash.peek()).toHaveProperty("value", expected);

          return;
        },
      );
    });
  }
};
