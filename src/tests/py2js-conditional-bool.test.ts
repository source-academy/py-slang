/**
 * docs/specs/python_typing.tex:56-57: "Following if and elif, Python §x only allows boolean
 * expressions." Until now that was only enforced for `while` (runtime.ts's whileCond) — `if`/`elif`
 * and the conditional expression `x if p else y` went through `truth()`, which accepts any type,
 * same as native Python. (The tex rule names only `if`/`elif`; the conditional expression is held
 * to the same rule here because docs/md/README_1.md and up present it as the same feature, under the
 * same "Conditional statements and conditional expressions" heading.) This file pins the newly-added
 * enforcement (runtime.ts's condBool, compiler.ts's "If"/"Ternary" cases).
 *
 * Both constructs share one message, `predicate type must be 'bool', not '<type>'` — SICP's term
 * for the condition, reused instead of "if condition"/"conditional expression condition" (which
 * read like two different checks rather than one shared rule), and phrased like an ordinary
 * operand-type error (`unsupported operand type(s) for -: 'int' and 'str'`).
 *
 * The CSE machine's BRANCH instruction does not enforce this yet (py-slang#436) — `cseErrors` below
 * documents the current divergence rather than asserting parity, matching py2js-loops.test.ts's own
 * `cseErrors` helper.
 */
import { Py2JsRunError, runCodePy2Js } from "../engines/py2js";
import { RunError, runCode } from "../runner";

async function cseErrors(code: string): Promise<boolean> {
  try {
    await runCode(code, 1);
    return false;
  } catch (e) {
    if (e instanceof RunError) return true;
    throw e;
  }
}

function py2jsOutcome(code: string): { error: string } | { output: string } {
  try {
    return { output: runCodePy2Js(code, 1).output };
  } catch (e) {
    if (e instanceof Py2JsRunError) return { error: e.message };
    throw e;
  }
}

describe("if/elif predicate must be bool", () => {
  test.each([
    ["if 1:\n    print(1)\nelse:\n    print(2)", "int"],
    ["if 0.0:\n    print(1)\nelse:\n    print(2)", "float"],
    ["if 'yes':\n    print(1)\nelse:\n    print(2)", "str"],
    ["if '':\n    print(1)\nelse:\n    print(2)", "str"],
    ["if None:\n    print(1)\nelse:\n    print(2)", "NoneType"],
    ["if print:\n    print(1)\nelse:\n    print(2)", "function"],
  ])("a non-bool condition is a TypeError: %s", async (code, typeName) => {
    // CSE currently takes the (any-truthy) if-branch instead of erroring — the divergence this file's
    // header documents.
    expect(await cseErrors(code)).toBe(false);
    const outcome = py2jsOutcome(code);
    expect(outcome).toHaveProperty("error");
    expect((outcome as { error: string }).error).toContain("TypeError");
    expect((outcome as { error: string }).error).toContain(
      `predicate type must be 'bool', not '${typeName}'`,
    );
  });

  test("a non-bool elif condition is also a TypeError (elif desugars to a nested if)", async () => {
    const code = "if False:\n    print(1)\nelif 5:\n    print(2)\nelse:\n    print(3)";
    expect(await cseErrors(code)).toBe(false);
    const outcome = py2jsOutcome(code);
    expect(outcome).toHaveProperty("error");
    expect((outcome as { error: string }).error).toContain(
      "predicate type must be 'bool', not 'int'",
    );
  });

  test.each([
    ["if True:\n    print('yes')\nelse:\n    print('no')", "yes\n"],
    ["if False:\n    print('yes')\nelse:\n    print('no')", "no\n"],
  ])("a bool condition still behaves normally: %s", (code, expected) => {
    expect(py2jsOutcome(code)).toEqual({ output: expected });
  });
});

describe("conditional expression (`x if p else y`) predicate must be bool", () => {
  test.each([
    ["print(1 if 5 else 2)", "int"],
    ["print(1 if 'x' else 2)", "str"],
    ["print(1 if None else 2)", "NoneType"],
  ])("a non-bool condition is a TypeError: %s", async (code, typeName) => {
    expect(await cseErrors(code)).toBe(false);
    const outcome = py2jsOutcome(code);
    expect(outcome).toHaveProperty("error");
    expect((outcome as { error: string }).error).toContain(
      `predicate type must be 'bool', not '${typeName}'`,
    );
  });

  test("a bool condition still behaves normally", () => {
    expect(py2jsOutcome("print(1 if True else 2)")).toEqual({ output: "1\n" });
    expect(py2jsOutcome("print(1 if False else 2)")).toEqual({ output: "2\n" });
  });

  test("a non-bool condition in tail position is also a TypeError (emitTailPosition's Ternary case)", async () => {
    const code = "def f():\n    return 1 if 5 else 2\nprint(f())";
    expect(await cseErrors(code)).toBe(false);
    const outcome = py2jsOutcome(code);
    expect(outcome).toHaveProperty("error");
    expect((outcome as { error: string }).error).toContain(
      `predicate type must be 'bool', not 'int'`,
    );
  });
});
