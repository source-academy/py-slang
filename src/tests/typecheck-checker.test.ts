import { TypedPythonChecker } from "../typecheck";
import { CHECKER_SETUP_TIMEOUT_MS, startTypedChecker } from "./typecheck-harness";

describe("the Typed Python §4 checker", () => {
  let checker: TypedPythonChecker;
  beforeAll(async () => {
    checker = await startTypedChecker();
  }, CHECKER_SETUP_TIMEOUT_MS);
  afterAll(() => checker.dispose());

  test("a correct program has no errors", async () => {
    const diagnostics = await checker.check(
      "def factorial(n: int) -> int:\n    return 1 if n == 0 else n * factorial(n - 1)\nprint(factorial(5))\n",
    );
    expect(diagnostics.filter(d => d.severity === "error")).toEqual([]);
  });

  test("a type error is reported with its line", async () => {
    const diagnostics = await checker.check('x = 1\ny: int = "a"\n');
    expect(diagnostics.filter(d => d.severity === "error")).toMatchObject([
      { line: 2, column: 9, rule: "reportAssignmentType" },
    ]);
  });
});
