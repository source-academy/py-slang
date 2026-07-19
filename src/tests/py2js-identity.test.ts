/**
 * py2js chapter 3: `is`/`is not`, universal `==`/`!=`, and bool participating
 * in ordering as the int it is — see docs/specs/python_typing_middle_34.tex
 * and runtime.ts's pyEquals/pyIdentical/pyOrder.
 *
 * The full operator × type × type cross product (including these three
 * changes) is swept automatically against a fresh CSE reference by
 * operator-conformance-py2js.test.ts's chapter-3 sweep; these are a few
 * directed cases for readability, plus the ones that need actual bindings
 * (aliasing) rather than fresh literals each time.
 */
import { runCodePy2Js } from "../engines/py2js";
import { runCode } from "../runner";

test.each([
  ["print(1 is 1)", "True\n"],
  ["print(None is None)", "True\n"],
  ["print(1 is not 2)", "True\n"],
  ["print(True == 1)", "True\n"],
  ["print(False == 0.0)", "True\n"],
  ["print(True < 2)", "True\n"],
  ["print(False <= 0)", "True\n"],
])("%s", (code, expected) => {
  expect(runCodePy2Js(code, 3).output).toBe(expected);
});

test("is/is not are rejected before chapter 3 (NoIsOperatorValidator + runtime backstop)", async () => {
  const code = "print(1 is 1)";
  await expect(runCode(code, 2)).rejects.toThrow();
  expect(() => runCodePy2Js(code, 2)).toThrow();
});

test("two separately-constructed equal lists are == but not is", () => {
  const code = "xs = [1, 2]\nys = [1, 2]\nprint(xs == ys)\nprint(xs is ys)";
  expect(runCodePy2Js(code, 3).output).toBe("True\nFalse\n");
});

test("the same list bound to two names is both == and is", () => {
  const code = "xs = [1, 2]\nys = xs\nprint(xs == ys)\nprint(xs is ys)";
  expect(runCodePy2Js(code, 3).output).toBe("True\nTrue\n");
});

test("bool/function are no longer excluded from == at chapter 3 (unlike chapter 1-2)", async () => {
  const code = "print(True == True)";
  await expect(runCode(code, 1)).rejects.toThrow();
  expect(() => runCodePy2Js(code, 1)).toThrow();
  expect(runCodePy2Js(code, 3).output).toBe("True\n");
});
