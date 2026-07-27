/**
 * Compiler/runtime paths the operator and stdlib conformance sweeps don't
 * reach because those evaluate expressions directly rather than through
 * structured statements: if/else with an else-block, boolean-shortcut
 * recursion in tail position, call-arity mismatches, and the parse/analysis/
 * runtime phase classification prepare() (index.ts) reports on Py2JsRunError.
 */
import { Py2JsRunError, runCodePy2Js } from "../engines/py2js";

function py2jsOutcome(code: string): { kind: string; message: string } | { output: string } {
  try {
    return { output: runCodePy2Js(code, 1).output };
  } catch (e) {
    if (e instanceof Py2JsRunError) return { kind: e.kind, message: e.message };
    throw e;
  }
}

test("if/else with both arms taken selects the right branch (else-block codegen)", () => {
  const code = `def sign(x):
    if x > 0:
        return "positive"
    else:
        return "non-positive"
print(sign(3))
print(sign(-3))`;
  expect(runCodePy2Js(code, 1).output).toBe("positive\nnon-positive\n");
});

test("boolean-shortcut recursion in tail position does not grow the JS call stack", () => {
  // `return base_case or recurse()` is a common SICP-style tail-recursive
  // idiom; emitTailPosition's BoolOp branch must emit a __py.tail marker for
  // the right operand, exactly like the plain-call case already covered.
  const code = `def count_down(n):
    return n == 0 or count_down(n - 1)
print(count_down(200000))`;
  expect(runCodePy2Js(code, 1).output).toBe("True\n");
});

test("calling a user function with the wrong number of arguments is a TypeError", () => {
  const code = `def add(x, y):
    return x + y
print(add(1, 2, 3))`;
  const outcome = py2jsOutcome(code);
  expect(outcome).toMatchObject({ kind: "runtime" });
  expect((outcome as { message: string }).message).toContain(
    "add() takes 2 arguments but 3 were given",
  );
});

describe("Py2JsRunError.kind classifies which phase failed", () => {
  test("a lexer/parser error is kind 'parse'", () => {
    // An indented line with no preceding block opener: rejected by the
    // lexer (UnexpectedIndentError) before the resolver ever runs.
    const outcome = py2jsOutcome("    x = 1\n");
    expect(outcome).toMatchObject({ kind: "parse" });
  });

  test("an unresolved name is kind 'analysis'", () => {
    const outcome = py2jsOutcome("print(nope)\n");
    expect(outcome).toMatchObject({ kind: "analysis" });
  });

  test("an error raised while the program runs is kind 'runtime'", () => {
    const outcome = py2jsOutcome("print(1 / 0)\n");
    expect(outcome).toMatchObject({ kind: "runtime" });
  });
});
