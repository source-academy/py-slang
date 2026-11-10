/**
 * The entry of the Python autograder (src/engines/py2js/grader.ts): a checker in a Node worker, and a
 * session that runs a checked program with its types erased.
 */
import { ensureTypedPython4Checker } from "../typecheck/bundler/typed4";
import {
  Py2JsSession,
  eraseTypesBeforeValidation,
  startNodeChecker,
} from "../engines/py2js/grader";
import { CHECKER_SETUP_TIMEOUT_MS } from "./typecheck-harness";

jest.setTimeout(60_000);

const typed = "def f(x: int) -> int:\n    return x + 1\nprint(f(2))\n";

async function run(program: string): Promise<string[]> {
  const lines: string[] = [];
  const session = new Py2JsSession(4, {
    onOutput: line => lines.push(line),
    beforeValidation: eraseTypesBeforeValidation,
  });
  await session.runChunk(program);
  return lines;
}

describe("the autograder entry", () => {
  test(
    "a typed program with no type errors runs, without its types",
    async () => {
      const checker = await startNodeChecker(await ensureTypedPython4Checker());
      try {
        expect(await checker.check(typed)).toEqual([]);
      } finally {
        checker.dispose();
      }
      expect(await run(typed)).toEqual(["3"]);
    },
    CHECKER_SETUP_TIMEOUT_MS,
  );

  test(
    "a type error is a diagnostic with its line",
    async () => {
      const checker = await startNodeChecker(await ensureTypedPython4Checker());
      try {
        const errors = (await checker.check('def f(x: int) -> int:\n    return "a"\n')).filter(
          d => d.severity === "error",
        );
        expect(errors).toHaveLength(1);
        expect(errors[0].line).toBe(2);
      } finally {
        checker.dispose();
      }
    },
    CHECKER_SETUP_TIMEOUT_MS,
  );

  test("a program that breaks the rules on the annotations is rejected", async () => {
    await expect(run("x: int\n")).rejects.toThrow();
  });
});
