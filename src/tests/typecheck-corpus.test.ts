/**
 * The type checker on programs of Python §4 Typed (src/tests/typecheck-cases/). In a file, a line
 * that ends with `# ERROR` must have an error, `# ERROR: text` one whose message contains the text;
 * every other line must have none. The `ok_` files are correct programs: no line has an error, and
 * they satisfy the rules that py-slang checks itself (an annotation on every def).
 */
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { parse } from "../parser/parser-adapter";
import { runCode } from "../runner";
import { prepareTypedProgram, TypedPythonChecker, type TypeDiagnostic } from "../typecheck";
import { CHECKER_SETUP_TIMEOUT_MS, startTypedChecker } from "./typecheck-harness";

// The checker runs in a worker thread: when many test files compete for the processor, a check takes
// much longer than the 5 seconds that a test has by default.
jest.setTimeout(60_000);

const CASES = join(__dirname, "typecheck-cases");
const MARKER = /#\s*ERROR(?::\s*(.*?))?\s*$/;

function errorsByLine(diagnostics: TypeDiagnostic[]): Map<number, TypeDiagnostic[]> {
  const byLine = new Map<number, TypeDiagnostic[]>();
  for (const d of diagnostics.filter(d => d.severity === "error")) {
    byLine.set(d.line, [...(byLine.get(d.line) ?? []), d]);
  }
  return byLine;
}

describe("the type checker on programs", () => {
  let checker: TypedPythonChecker;
  beforeAll(async () => {
    checker = await startTypedChecker();
  }, CHECKER_SETUP_TIMEOUT_MS);
  afterAll(() => checker.dispose());

  const files = readdirSync(CASES)
    .filter(file => file.endsWith(".py"))
    .sort();

  test.each(files)("%s", async file => {
    const source = readFileSync(join(CASES, file), "utf8");
    const diagnostics = await checker.check(source);
    const found = errorsByLine(diagnostics);

    const expected = new Map<number, string | undefined>();
    source.split("\n").forEach((line, i) => {
      const marker = MARKER.exec(line);
      if (marker) expected.set(i + 1, marker[1]);
    });

    const missing: string[] = [];
    const wrongMessage: string[] = [];
    for (const [line, text] of expected) {
      const errors = found.get(line);
      if (!errors) missing.push(`line ${line}`);
      else if (text && !errors.some(e => e.message.includes(text))) {
        wrongMessage.push(
          `line ${line}: wanted "${text}", got ${errors.map(e => e.message).join(" | ")}`,
        );
      }
    }
    const unexpected = [...found]
      .filter(([line]) => !expected.has(line))
      .map(([line, errors]) => `line ${line}: ${errors.map(e => e.message).join(" | ")}`);

    expect({ missing, wrongMessage, unexpected }).toEqual({
      missing: [],
      wrongMessage: [],
      unexpected: [],
    });

    if (file.startsWith("ok_")) {
      // A correct program has an annotation on every def: py-slang's own typed rules accept it.
      expect(() =>
        prepareTypedProgram(parse(source.endsWith("\n") ? source : source + "\n")),
      ).not.toThrow();
    }
  });

  test("an unannotated function is an error for the checker too", async () => {
    const diagnostics = await checker.check("def f(x):\n    return x\nprint(f(1))\n");
    // The parameter has no type, and so the result of the function has none.
    expect([...errorsByLine(diagnostics).keys()]).toEqual([1, 2]);
  });

  test("both operands of and/or must be bools, as the condition of an if is", async () => {
    // Pyright does not validate them itself: the build adds the check (`patchBoolOperandChecks`).
    const diagnostics = await checker.check(
      "a = 3 and True\nb = True and 4\nc = 'a' or False\nd = False or 'a'\ne = True and False or True\n",
    );
    expect([...errorsByLine(diagnostics).keys()]).toEqual([1, 2, 3, 4]);
    // The engines still run `False and 1`, whose value is the right operand, unchecked: that keeps
    // `n == 0 or is_odd(n - 1)` iterative, and it is the checker that makes the operand a bool.
    // They reject a left operand that is not a bool, as in Python §4.
    await expect(runCode("print(3 and 4)\n", 4)).rejects.toThrow();
  });
});
