/**
 * Unit tests for the Moo-based lexer's indentation handling.
 *
 * Tests exercise processTokens() indirectly through the exported
 * pythonLexer (PythonLexer wrapper).
 */
import pythonLexer from "../parser/lexer";
import { UnexpectedIndentError, InconsistentDedentError } from "../parser/lexer-errors";
import type moo from "moo";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Tokenize input and return all tokens as an array. */
function tokenize(src: string): moo.Token[] {
  pythonLexer.reset(src);
  const tokens: moo.Token[] = [];
  let tok: moo.Token | undefined;
  while ((tok = pythonLexer.next())) {
    tokens.push(tok);
  }
  return tokens;
}

/** Extract just the token types from input, for concise assertions. */
function tokenTypes(src: string): string[] {
  return tokenize(src).map(t => t.type!);
}

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------
describe("Lexer indentation errors", () => {
  test("leading indentation before first statement throws UnexpectedIndentError", () => {
    expect(() => tokenize("    x = 1\n")).toThrow(UnexpectedIndentError);
  });

  test("inconsistent dedent throws InconsistentDedentError", () => {
    // Indent to 4, then 8, then dedent to 3 (never on the stack)
    const src = [
      "if True:\n",
      "    if True:\n",
      "        x = 1\n",
      "   y = 2\n", // dedent to 3 spaces — inconsistent
    ].join("");
    expect(() => tokenize(src)).toThrow(InconsistentDedentError);
  });

  test("mixed tabs and spaces causing mismatch on dedent throws InconsistentDedentError", () => {
    // Indent with tab, then dedent with spaces — strings won't match
    const src = "if True:\n\tx = 1\n    y = 2\n";
    expect(() => tokenize(src)).toThrow(InconsistentDedentError);
  });
});

// ---------------------------------------------------------------------------
// Valid cases
// ---------------------------------------------------------------------------
describe("Lexer valid indentation", () => {
  test("normal indent/dedent cycle", () => {
    const src = "if True:\n    x = 1\ny = 2\n";
    const types = tokenTypes(src);
    expect(types).toContain("indent");
    expect(types).toContain("dedent");
  });

  test("multiple dedents at once (8 to 4 to 0)", () => {
    const src = ["if True:\n", "    if True:\n", "        x = 1\n", "y = 2\n"].join("");
    const types = tokenTypes(src);
    const dedentCount = types.filter(t => t === "dedent").length;
    expect(dedentCount).toBe(2);
  });

  test("blank lines with arbitrary whitespace between statements", () => {
    const src = "x = 1\n\n     \n\ny = 2\n";
    expect(() => tokenize(src)).not.toThrow();
  });

  test("comment-only lines with indentation", () => {
    const src = "x = 1\n    # indented comment\ny = 2\n";
    expect(() => tokenize(src)).not.toThrow();
  });

  test("empty file", () => {
    expect(() => tokenize("")).not.toThrow();
    expect(tokenize("")).toHaveLength(0);
  });

  test("leading blank lines then code at col 0", () => {
    const src = "\n\n\nx = 1\n";
    expect(() => tokenize(src)).not.toThrow();
  });

  test("consistent 3-space indentation throughout", () => {
    const src = "if True:\n   x = 1\n   y = 2\ny = 3\n";
    expect(() => tokenize(src)).not.toThrow();
    const types = tokenTypes(src);
    expect(types).toContain("indent");
    expect(types).toContain("dedent");
  });

  test("sudden double-indent (4 to 12) is valid single indent level", () => {
    const src = "if True:\n    if True:\n            x = 1\n";
    expect(() => tokenize(src)).not.toThrow();
    const types = tokenTypes(src);
    const indentCount = types.filter(t => t === "indent").length;
    expect(indentCount).toBe(2);
  });

  test("nested blocks with consistent indentation", () => {
    const src = ["def f():\n", "    if True:\n", "        x = 1\n", "    y = 2\n", "z = 3\n"].join(
      "",
    );
    expect(() => tokenize(src)).not.toThrow();
    const types = tokenTypes(src);
    expect(types.filter(t => t === "indent").length).toBe(2);
    expect(types.filter(t => t === "dedent").length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Explicit line continuation (backslash-newline)
// ---------------------------------------------------------------------------
describe("Lexer explicit line continuation", () => {
  test("backslash-newline joins two physical lines into one logical line", () => {
    const src = "total = 1 + 2 + 3 + \\\n        4 + 5\n";
    const types = tokenTypes(src);
    // Only one logical-line newline should be emitted (the trailing one),
    // and no indent/dedent tokens from the continuation's leading whitespace.
    expect(types.filter(t => t === "newline")).toHaveLength(1);
    expect(types).not.toContain("indent");
    expect(types).not.toContain("dedent");
  });

  test("continuation inside an indented block", () => {
    const src = "def f():\n    x = 1 + \\\n        2\n    return x\n";
    expect(() => tokenize(src)).not.toThrow();
    const types = tokenTypes(src);
    expect(types.filter(t => t === "indent").length).toBe(1);
    expect(types.filter(t => t === "dedent").length).toBe(1);
  });

  test("CRLF line ending after backslash", () => {
    const src = "total = 1 + \\\r\n2\r\n";
    expect(() => tokenize(src)).not.toThrow();
  });

  test("multiple consecutive continuations", () => {
    const src = "x = 1 + \\\n    2 + \\\n    3\n";
    expect(() => tokenize(src)).not.toThrow();
  });

  test("backslash not immediately followed by newline still throws", () => {
    expect(() => tokenize("x = 1 \\ + 2\n")).toThrow();
  });
});
