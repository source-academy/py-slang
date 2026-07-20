/**
 * py2js host-function boundary (#287 review): a plain JS function supplied
 * via extraBuiltins — no pyName/pyArity metadata — must behave like a proper
 * builtin, not crash. prepare() establishes the PyFunction metadata invariant
 * (annotateHostFunction in engines/py2js/runtime.ts); arity() and the stdlib
 * bridge's toTagged additionally carry Function#length fallbacks for
 * functions that bypass it.
 */
import { runCodePy2Js, PyValue } from "../engines/py2js";

// Deliberately un-annotated: what a naive host/module integration would pass.
const bare = ((x: PyValue) => (x as bigint) * 2n) as unknown as PyValue;
const bareRest = ((...xs: PyValue[]) => BigInt(xs.length)) as unknown as PyValue;

test("bare host function is callable", () => {
  const { output } = runCodePy2Js(`print(twice(21))`, 1, { extraBuiltins: { twice: bare } });
  expect(output).toBe("42\n");
});

test("arity() of a bare host function reports Function#length instead of crashing", () => {
  const { output } = runCodePy2Js(`print(arity(twice))`, 1, { extraBuiltins: { twice: bare } });
  expect(output).toBe("1\n");
});

test("argument counts are not enforced for bare host functions (rest args report length 0)", () => {
  const { output } = runCodePy2Js(`print(count(1, 2, 3))`, 1, {
    extraBuiltins: { count: bareRest },
  });
  expect(output).toBe("3\n");
});

test("bare host function renders under its binding name", () => {
  const { output } = runCodePy2Js(`print(twice)\nprint(str(twice))`, 1, {
    extraBuiltins: { twice: bare },
  });
  expect(output).toBe("<built-in function twice>\n<built-in function twice>\n");
});
