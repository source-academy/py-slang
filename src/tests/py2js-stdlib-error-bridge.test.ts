/**
 * py2js#295: a stdlib builtin bridged from the CSE machine (stdlibBridge.ts)
 * that raises a runtime error must surface a real message, not
 * "[object Object]". CSE's own runtime error classes (TypeError,
 * IndexError, ...) implement SourceError rather than extending Error (see
 * errors/errors.ts's RuntimeSourceError), so they fail every `instanceof
 * Error` check up the call chain unless bridgeBuiltin converts them at the
 * boundary where they actually originate.
 */
import { runCodePy2Js, Py2JsSession } from "../engines/py2js";

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

/**
 * py-slang#397: bridged builtins raise using a synthetic call-site token (see
 * stdlibBridge.ts's syntheticCallNode) with no real source position, so the
 * TypeError/ValueError location header ("at line 1\n\n...") errors.ts would
 * otherwise print is not just imprecise, it's actively wrong — always
 * reporting a placeholder near the top of the file regardless of where the
 * call actually happened. Two independent lines of defense here: never print
 * a fabricated location at all, and where possible name the enclosing
 * predefined (prelude) function instead, so "unsupported argument type for
 * tail" at least says *which* library call the student wrote led there.
 */
describe("py-slang#397: no fabricated line number, name the enclosing predefined function", () => {
  test("a leading blank line before the call does not produce a wrong line number", () => {
    let message = "";
    try {
      runCodePy2Js("\n\n\ntail(0)", 2);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).not.toMatch(/at line/);
    expect(message).toMatch(/unsupported argument type for tail/);
  });

  test("a ValueError also has no fabricated line number", () => {
    let message = "";
    try {
      runCodePy2Js("\n\nmath_sqrt(-1)", 2);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).not.toMatch(/at line/);
    expect(message).toMatch(/math domain error/);
  });

  // Pre-existing crash on main, incidentally fixed by the same synthetic-token check:
  // ValueError's location header did `" ".repeat(offset)`, and offset is -1 whenever
  // fullLine.indexOf(snippet) can't find the (synthetic, not-really-there) snippet in
  // the line it's pointing at — String#repeat throws RangeError on a negative count,
  // so a ValueError-raising builtin like math_sqrt crashed with a raw JS RangeError
  // instead of ever producing a Python-style error at all.
  test("math_sqrt(-1) raises a real ValueError, not a raw JS RangeError", () => {
    let caught: unknown;
    try {
      runCodePy2Js("math_sqrt(-1)", 2);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).name).not.toBe("RangeError");
    expect((caught as Error).message).not.toMatch(/Invalid count value/);
    expect((caught as Error).message).toMatch(/math domain error/);
  });

  test("tail() failing inside map()'s own internal helper names map, not the helper", () => {
    let message = "";
    try {
      runCodePy2Js("map(print, 0)", 2);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/in predefined function 'map'/);
    expect(message).not.toMatch(/_map/);
  });

  test("a builtin called directly at the top level names no enclosing function", () => {
    let message = "";
    try {
      runCodePy2Js("tail(0)", 2);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).not.toMatch(/predefined function/);
  });

  test("an error inside the student's own callback is never blamed on map", () => {
    let message = "";
    try {
      runCodePy2Js("def bad(x):\n    return tail(x)\nmap(bad, pair(1, None))", 2);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).not.toMatch(/predefined function/);
  });

  // Py2JsSession (what the conductor evaluator actually uses for the Playground)
  // loads the stdlib prelude through its own runChunk, a separate code path from
  // setupRuntime's one-shot prelude load that runCodePy2Js/runCodePy2JsDual use —
  // each needs its own compilingPrelude wrapping, or prelude functions loaded via
  // a session never get tagged pyPrelude and this attribution silently never fires.
  test("Py2JsSession also names the enclosing predefined function", async () => {
    const session = new Py2JsSession(2);
    let message = "";
    try {
      await session.runChunk("map(1, 2)");
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/in predefined function 'map'/);
  });
});
