/**
 * Unbound-name semantics parity: Python's environments grow dynamically (no
 * TDZ), but reading a binding whose assignment never executed is an error —
 * UnboundLocalError for function locals, NameError at module level. The CSE
 * machine implements this; py2js compiles guarded reads (see emitName in
 * engines/py2js/compiler.ts) because JS `let` would otherwise leak a silent
 * `undefined`. Each case runs on both engines and must agree on
 * success-vs-error; the error kind is asserted on the py2js side.
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

test("local read before assignment is an UnboundLocalError (CSE parity)", async () => {
  const code = `def f():
    y = x
    x = 1
    return y
x = 5
print(f())`;
  expect(await cseErrors(code)).toBe(true);
  const outcome = py2jsOutcome(code);
  expect(outcome).toHaveProperty("error");
  expect((outcome as { error: string }).error).toContain("UnboundLocalError");
});

test("local bound only in a not-taken branch is an UnboundLocalError (CSE parity)", async () => {
  const code = `def f(c):
    if c:
        x = 1
    return x
print(f(False))`;
  expect(await cseErrors(code)).toBe(true);
  const outcome = py2jsOutcome(code);
  expect(outcome).toHaveProperty("error");
  expect((outcome as { error: string }).error).toContain("UnboundLocalError");
});

test("module-level name bound only in a not-taken branch is a NameError (CSE parity)", async () => {
  const code = `if 1 > 2:
    y = 1
print(y)`;
  expect(await cseErrors(code)).toBe(true);
  const outcome = py2jsOutcome(code);
  expect(outcome).toHaveProperty("error");
  expect((outcome as { error: string }).error).toContain("NameError");
});

test("assigning the same local in both if/else arms is NameReassignmentError at §1 (CSE parity)", async () => {
  // Source §1's no-reassignment rule is const-like: the second arm's
  // assignment counts as a reassignment even though the arms are exclusive.
  // Both engines run the same validators, so both reject identically.
  const code = `def f(c):
    if c:
        x = 1
    else:
        x = 2
    return x
print(f(True), f(False))`;
  expect(await cseErrors(code)).toBe(true);
  const outcome = py2jsOutcome(code);
  expect(outcome).toHaveProperty("error");
  expect((outcome as { error: string }).error).toContain("NameReassignmentError");
});

test("the taken branch binds normally on both engines", async () => {
  const code = `def f(c):
    if c:
        x = 1
    return x
print(f(True))`;
  expect(await cseErrors(code)).toBe(false);
  expect(py2jsOutcome(code)).toEqual({ output: "1\n" });
});

test("closures reading enclosing locals stay unguarded-correct", async () => {
  const code = `def outer():
    n = 10
    def inner():
        return n + 1
    return inner()
print(outer())`;
  expect(await cseErrors(code)).toBe(false);
  expect(py2jsOutcome(code)).toEqual({ output: "11\n" });
});
