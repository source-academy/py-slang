/**
 * The type checker on programs of Typed Python §4 (src/tests/typecheck-cases/). In a file, a line
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

  test("the left operand of and/or is not checked statically: a limitation, in the specification", async () => {
    // Python §4 wants a bool there. Pyright has no rule for it, and `and` does not call a method of
    // its operand's type that could be changed (making `__bool__` an error is what makes `if 1:` an
    // error, and it has no effect here), so there is no static error ...
    const diagnostics = await checker.check("k = 3 and 4\nm = 'a' or 1\n");
    expect(errorsByLine(diagnostics).size).toBe(0);
    // ... and the engines report it when the program runs.
    await expect(runCode("print(3 and 4)\n", 4)).rejects.toThrow();
  });
});
