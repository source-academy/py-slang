/**
 * py2js#295: a stdlib builtin bridged from the CSE machine (stdlibBridge.ts)
 * that raises a runtime error must surface a real message, not
 * "[object Object]". CSE's own runtime error classes (TypeError,
 * IndexError, ...) implement SourceError rather than extending Error (see
 * errors/errors.ts's RuntimeSourceError), so they fail every `instanceof
 * Error` check up the call chain unless bridgeBuiltin converts them at the
 * boundary where they actually originate.
 */
import { runCodePy2Js } from "../engines/py2js";

test("tail() on a non-pair surfaces a real TypeError, not [object Object]", () => {
  expect(() => runCodePy2Js("print(tail(5))", 2)).toThrow(
    /TypeError.*unsupported argument type for tail/s,
  );
});

test("head() on a non-pair surfaces a real TypeError, not [object Object]", () => {
  expect(() => runCodePy2Js("print(head(5))", 2)).toThrow(
    /TypeError.*unsupported argument type for head/s,
  );
});

test("the thrown error's message is never the literal string [object Object]", () => {
  let caught: unknown;
  try {
    runCodePy2Js("print(tail(5))", 2);
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(Error);
  expect((caught as Error).message).not.toBe("[object Object]");
});
