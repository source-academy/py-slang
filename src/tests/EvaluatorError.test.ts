import { EvaluatorError } from "../conductor/errors";
import { ResolverErrors } from "../resolver/errors";
import { toPythonAstAndResolve } from "./utils";

describe("EvaluatorError", () => {
  test("extracts line/column from a SourceError-shaped location.start", () => {
    const source = {
      name: "RuntimeError",
      message: "boom",
      location: { start: { line: 5, column: 2 } },
    };
    const wrapped = new EvaluatorError(source);
    expect(wrapped.line).toBe(5);
    expect(wrapped.column).toBe(2);
    expect(wrapped.name).toBe("RuntimeError");
  });

  test("falls back to a flat line/col when location is absent (BaseResolverError's shape)", () => {
    const source = { name: "NameNotFoundError", message: "boom", line: 7, col: 3 };
    const wrapped = new EvaluatorError(source);
    expect(wrapped.line).toBe(7);
    expect(wrapped.column).toBe(3);
  });

  test("leaves line/column undefined when neither shape is present", () => {
    const wrapped = new EvaluatorError({ name: "Error", message: "boom" });
    expect(wrapped.line).toBeUndefined();
    expect(wrapped.column).toBeUndefined();
  });

  test("prefers location.start over a flat line/col when both are present", () => {
    const source = {
      name: "Weird",
      message: "boom",
      location: { start: { line: 5, column: 2 } },
      line: 99,
      col: 99,
    };
    const wrapped = new EvaluatorError(source);
    expect(wrapped.line).toBe(5);
    expect(wrapped.column).toBe(2);
  });

  // Regression test: BaseResolverError (NameNotFoundError, NameReassignmentError, etc.) extends
  // the native SyntaxError and carries a flat line/col rather than SourceError's location.start -
  // EvaluatorError silently dropped it before, which is why a student's Run/testcase never showed
  // a corrected line number for one of these (source-academy/frontend#4244's fix had nothing to
  // shift, since EvaluatorError.line was always undefined for this error class).
  test("preserves a real BaseResolverError's line/column", () => {
    const code = "print(x)";
    let caught: unknown;
    try {
      toPythonAstAndResolve(code, 1);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ResolverErrors.NameNotFoundError);
    const wrapped = new EvaluatorError(caught);
    expect(wrapped.line).toBe(1);
    expect(typeof wrapped.column).toBe("number");
  });
});
