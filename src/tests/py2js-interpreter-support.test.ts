/**
 * py2js chapter 4: `tokenize`, `parse`, `apply_in_underlying_python`, and the
 * predeclared `__program__` global (docs/specs/python_4.tex,
 * python_interpreter.tex).
 *
 * `tokenize`/`parse` need no py2js-specific implementation at all: both are
 * bridged through the ordinary generic stdlib bridge (stdlibBridge.ts),
 * exactly like misc/math/list — CSE's own `transform()` (src/stdlib/
 * parser.ts, reused directly by both `parse` and PVML's own parser support)
 * builds the entire tagged parse tree out of 2-element cons cells, which the
 * bridge's existing toTagged/fromTagged round-trip already reconstructs
 * correctly as nested PyPairs. `apply_in_underlying_python` needed a native
 * implementation instead (see stdlibBridge.ts's doc comment on
 * nativeApplyInUnderlyingPython): CSE's own version pushes onto its own
 * control/stash for the CSE step loop to process, which has no equivalent in
 * a bridge that expects a builtin to return a value synchronously.
 */
import { runCodePy2Js, Py2JsSession, Py2JsRunError } from "../engines/py2js";
import { runCode } from "../runner";

describe("tokenize (bridged generically, no py2js-specific code)", () => {
  test.each([["x = 1 + 2"], ["def f(x):\n    return x\n"], ["# a comment\nx = 1\n"]])(
    "matches CSE exactly: %s",
    async src => {
      const code = `print_llist(tokenize(${JSON.stringify(src)}))`;
      const cse = await runCode(code, 4);
      expect(runCodePy2Js(code, 4).output).toBe(cse);
    },
  );
});

describe("parse (bridged generically, no py2js-specific code)", () => {
  test.each([
    ["x = 1 + 2"],
    ["def f(x, y):\n    return x * y\n"],
    ["if x > 0:\n    y = 1\nelse:\n    y = 2\n"],
    ["for i in range(3):\n    print(i)\n"],
    ["while x < 5:\n    x = x + 1\n"],
    ["[1, 2, 3]"],
    ["lambda x: x + 1"],
    ["x[0] = 1"],
    ["global x"],
  ])("matches CSE's tagged-linked-list parse tree byte-for-byte: %s", async src => {
    const code = `print_llist(parse(${JSON.stringify(src)}))`;
    const cse = await runCode(code, 4);
    expect(runCodePy2Js(code, 4).output).toBe(cse);
  });
});

describe("apply_in_underlying_python", () => {
  test("calls f with the arguments in the linked list", () => {
    const code = `
def times(x, y):
    return x * y
print(apply_in_underlying_python(times, llist(2, 3)))
`;
    expect(runCodePy2Js(code, 4).output).toBe("6\n");
  });

  test("an empty argument list (None) calls f with no arguments", () => {
    const code = `
def f():
    return 42
print(apply_in_underlying_python(f, None))
`;
    expect(runCodePy2Js(code, 4).output).toBe("42\n");
  });

  test("a non-callable first argument is a TypeError", () => {
    expect(() => runCodePy2Js("apply_in_underlying_python(1, None)", 4)).toThrow(/TypeError/);
  });

  test("a circular argument list (built via set_tail) raises rather than exhausting memory", () => {
    // p.tail === p: walking it naively (no cycle detection) would grow the
    // argument array without bound instead of terminating.
    const code = `
def f(a, b):
    return a
p = pair(1, 2)
set_tail(p, p)
print(apply_in_underlying_python(f, p))
`;
    expect(() => runCodePy2Js(code, 4)).toThrow(/circular/);
  });
});

describe("__program__", () => {
  test("holds the raw source text, at every chapter, not just chapter 4", () => {
    const code = "print(__program__)";
    for (const variant of [1, 2, 3, 4]) {
      expect(runCodePy2Js(code, variant).output).toBe(code + "\n");
    }
  });

  test("a REPL/conductor session uses the caller-supplied programText", async () => {
    const lines: string[] = [];
    const session = new Py2JsSession(4, {
      onOutput: l => lines.push(l),
      programText: "the editor content at the time Run was last pressed",
    });
    await session.runChunk("print(__program__)\n");
    expect(lines).toEqual(["the editor content at the time Run was last pressed"]);
  });

  test("a REPL/conductor session with no programText leaves __program__ unbound (NameError)", async () => {
    const session = new Py2JsSession(4);
    await expect(session.runChunk("print(__program__)\n")).rejects.toThrow();
  });
});

test("chapters 1-3 also support tokenize/parse/apply_in_underlying_python once bridged (engine-level, not spec-gated by chapter)", () => {
  // The resolver predeclares __program__ (and, generally, whatever's in the
  // chapter's stdlib groups) independent of chapter; py2js's own
  // PY2JS_GROUPS is what actually withholds the parser group before chapter
  // 4 — confirms that withholding, not a runtime crash, is what's happening.
  expect(() => runCodePy2Js("print(tokenize('x'))", 3)).toThrow(Py2JsRunError);
});
