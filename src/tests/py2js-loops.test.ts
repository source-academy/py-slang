/**
 * py2js chapter 3: while/for/break/continue.
 *
 * The `while`/`for` fixtures below are taken directly from loops.test.ts (the
 * CSE/PVML/native-Pynter/CPython conformance suite for these constructs), so
 * py2js is pinned against the exact same reference behavior — including the
 * `while` condition's stricter-than-Python bool requirement (see
 * runtime.ts's whileCond) and range()'s three call shapes.
 *
 * Two cases get dedicated attention beyond that shared fixture list:
 *  - the for-loop target does NOT survive reassignment inside the body (the
 *    hidden counter that actually drives iteration is a separate, compiler-
 *    internal variable — see compiler.ts's For case and
 *    docs/specs/python_loops.tex's desugaring);
 *  - `continue` inside a for-loop still advances that hidden counter (a
 *    while-based desugaring using a trailing increment statement would hang
 *    forever the first time the body actually continues, since `continue`
 *    skips straight to the condition check).
 */
import { Py2JsRunError, runCodePy2Js } from "../engines/py2js";
import { RunError, runCode } from "../runner";

async function cseErrors(code: string): Promise<boolean> {
  try {
    await runCode(code, 3);
    return false;
  } catch (e) {
    if (e instanceof RunError) return true;
    throw e;
  }
}

function py2jsOutcome(code: string): { error: string } | { output: string } {
  try {
    return { output: runCodePy2Js(code, 3).output };
  } catch (e) {
    if (e instanceof Py2JsRunError) return { error: e.message };
    throw e;
  }
}

describe("for loops (loops.test.ts fixtures)", () => {
  test.each([
    ["for i in range(5):\n    print(i)\ni", ["0", "1", "2", "3", "4"]],
    ["for i in range(2, 5):\n    print(i)\ni", ["2", "3", "4"]],
    ["for i in range(1, 10, 2):\n    print(i)\ni", ["1", "3", "5", "7", "9"]],
    ["for i in range(5, 0, -1):\n    print(i)\ni", ["5", "4", "3", "2", "1"]],
    ["for i in range(0):\n    print(i)\n3", []],
    ["for i in range(5):\n    i = 0\n    print(i)\ni", ["0", "0", "0", "0", "0"]],
    ["x = 3\nfor x in range(x, x + 5):\n    print(x)\nx", ["3", "4", "5", "6", "7"]],
    ["for i in range(5, 5, 1):\n    print(i)\n3", []],
    ["for i in range(5, 3, 1):\n    print(i)\n3", []],
    ["for i in range(3, 5, -1):\n    print(i)\n3", []],
  ])("%s", async (code, printedLines) => {
    expect(await cseErrors(code)).toBe(false);
    const expected = printedLines.length === 0 ? "" : printedLines.join("\n") + "\n";
    expect(py2jsOutcome(code)).toEqual({ output: expected });
  });

  test("iterating a non-range() expression is rejected (ForRangeOnlyValidator)", async () => {
    const code = "for i in [10, 20, 30]:\n    print(i)";
    expect(await cseErrors(code)).toBe(true);
    expect(py2jsOutcome(code)).toHaveProperty("error");
  });

  test("a zero step is a ValueError", async () => {
    const code = "for i in range(1, 10, 0):\n    print(i)";
    expect(await cseErrors(code)).toBe(true);
    const outcome = py2jsOutcome(code);
    expect(outcome).toHaveProperty("error");
    expect((outcome as { error: string }).error).toContain("ValueError");
  });

  test("continue advances the hidden loop counter, not just the visible target", () => {
    // A while-desugaring with a *trailing* increment statement would hang
    // forever here: `continue` jumps straight to the condition check,
    // skipping any statement placed after the body.
    const code =
      "total = 0\nfor i in range(6):\n    if i == 3:\n        continue\n    total = total + i\nprint(total)";
    expect(runCodePy2Js(code, 3).output).toBe("12\n");
  });

  test("break exits only the innermost loop", () => {
    const code =
      "total = 0\nfor i in range(3):\n    for j in range(10):\n        if j == 2:\n            break\n        total = total + 1\nprint(total)";
    expect(runCodePy2Js(code, 3).output).toBe("6\n");
  });
});

describe("while loops (loops.test.ts fixtures)", () => {
  test.each([
    ["i = 0\nwhile i < 5:\n    print(i)\n    i = i + 1\ni", ["0", "1", "2", "3", "4"]],
    ["i = 0\nwhile i < 5:\n    print(i)\n    i = i + 2\ni", ["0", "2", "4"]],
    ["i = 5\nwhile i > 0:\n    print(i)\n    i = i - 1\ni", ["5", "4", "3", "2", "1"]],
    [
      "i = 0\nwhile i < 5:\n    print(i)\n    if i == 2:\n        break\n    i = i + 1\ni",
      ["0", "1", "2"],
    ],
    [
      "i = 0\nwhile i < 5:\n    if i == 2:\n        i = i + 1\n        continue\n    print(i)\n    i = i + 1\ni",
      ["0", "1", "3", "4"],
    ],
  ])("%s", async (code, printedLines) => {
    expect(await cseErrors(code)).toBe(false);
    expect(py2jsOutcome(code)).toEqual({ output: printedLines.join("\n") + "\n" });
  });

  test.each([
    ["y = 1\nwhile y + 1:\n    y = y + 1"],
    ["while 1:\n    pass"],
    ["while 0:\n    pass"],
    ["while None:\n    pass"],
  ])("a non-bool condition is a TypeError: %s", async code => {
    expect(await cseErrors(code)).toBe(true);
    const outcome = py2jsOutcome(code);
    expect(outcome).toHaveProperty("error");
    expect((outcome as { error: string }).error).toContain("TypeError");
  });
});

test("a closure created inside a for-loop body shares the one mutable loop variable across iterations", () => {
  // Matches CPython's well-known for-loop closure gotcha: since the for-loop
  // desugars to a single mutable binding (not a fresh one per iteration),
  // every closure captured inside the loop sees whatever the variable holds
  // by the time it's *called*, not the value at the time it was created.
  const code = `fns = [None, None, None]
for i in range(3):
    def f():
        return i
    fns[i] = f
print(fns[0]())
print(fns[1]())
print(fns[2]())
`;
  expect(runCodePy2Js(code, 3).output).toBe("2\n2\n2\n");
});
