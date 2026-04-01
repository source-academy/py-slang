/**
 * Two-pass Python lexer: Moo tokenization → indent/dedent injection.
 *
 * Pass 1: moo.compile() produces a flat token stream.
 * Pass 2: processTokens() strips whitespace/comments, tracks enclosure
 *         depth, and emits synthetic indent/dedent tokens.
 */

import moo from "moo";
import { InconsistentDedentError, UnexpectedIndentError } from "./lexer-errors";

// ── Moo configuration (unchanged) ──────────────────────────────────────────

const kwType = moo.keywords({
  kw_def: "def",
  kw_if: "if",
  kw_elif: "elif",
  kw_else: "else",
  kw_while: "while",
  kw_for: "for",
  kw_in: "in",
  kw_return: "return",
  kw_pass: "pass",
  kw_break: "break",
  kw_continue: "continue",
  kw_and: "and",
  kw_or: "or",
  kw_not: "not",
  kw_is: "is",
  kw_lambda: "lambda",
  kw_from: "from",
  kw_import: "import",
  kw_global: "global",
  kw_nonlocal: "nonlocal",
  kw_as: "as",
  kw_assert: "assert",
  kw_True: "True",
  kw_False: "False",
  kw_None: "None",
  // Forbidden keywords (surface as their own type so callers can error nicely)
  forbidden_async: "async",
  forbidden_await: "await",
  forbidden_yield: "yield",
  forbidden_with: "with",
  forbidden_del: "del",
  forbidden_try: "try",
  forbidden_except: "except",
  forbidden_finally: "finally",
  forbidden_raise: "raise",
  forbidden_class: "class",
});

const mooLexer = moo.compile({
  newline: { match: /\r?\n/, lineBreaks: true },
  ws: /[ \t]+/,
  comment: /#[^\r\n]*/,

  number_complex: /(?:\d+\.?\d*|\.\d+)[jJ]/,
  number_float: /(?:\d+\.\d*|\.\d+)(?:[eE][+-]?\d+)?/,
  number_hex: /0[xX][0-9a-fA-F]+/,
  number_oct: /0[oO][0-7]+/,
  number_bin: /0[bB][01]+/,
  number_int: /\d+/,

  string_triple_double: /"""(?:[^\\]|\\.)*?"""/,
  string_triple_single: /'''(?:[^\\]|\\.)*?'''/,
  string_double: /"(?:[^"\\]|\\.)*"/,
  string_single: /'(?:[^'\\]|\\.)*'/,

  doublestar: "**",
  doubleslash: "//",
  doubleequal: "==",
  notequal: "!=",
  lessequal: "<=",
  greaterequal: ">=",
  doublecolon: "::",
  ellipsis: "...",

  lparen: "(",
  rparen: ")",
  lsqb: "[",
  rsqb: "]",
  lbrace: "{",
  rbrace: "}",
  colon: ":",
  comma: ",",
  plus: "+",
  minus: "-",
  star: "*",
  slash: "/",
  percent: "%",
  less: "<",
  greater: ">",
  equal: "=",
  dot: ".",
  semi: ";",

  name: { match: /[a-zA-Z_][a-zA-Z0-9_]*/, type: kwType },
});

// ── Openers / closers for enclosure tracking ───────────────────────────────

const OPENERS = new Set(["(", "[", "{"]);
const CLOSERS = new Set([")", "]", "}"]);

// ── Synthetic token factory ────────────────────────────────────────────────

function syntheticToken(type: string, ref: moo.Token): moo.Token {
  return {
    type,
    value: "",
    text: "",
    toString: ref.toString,
    offset: ref.offset,
    lineBreaks: 0,
    line: ref.line,
    col: ref.col,
  };
}

// ── Pass 2: processTokens ──────────────────────────────────────────────────

function processTokens(raw: moo.Token[]): moo.Token[] {
  const out: moo.Token[] = [];
  const indentStack: string[] = [""];
  let enclosureDepth = 0;
  let i = 0;

  // Reject leading indentation (whitespace before the first real token
  // with no preceding newline).
  {
    let j = 0;
    while (j < raw.length && (raw[j].type === "comment" || raw[j].type === "newline")) j++;
    if (j < raw.length && raw[j].type === "ws") {
      throw new UnexpectedIndentError(raw[j].line, raw[j].col);
    }
  }

  while (i < raw.length) {
    const tok = raw[i];

    // Always skip whitespace and comments
    if (tok.type === "ws" || tok.type === "comment") {
      i++;
      continue;
    }

    // Track enclosure depth
    if (OPENERS.has(tok.text)) {
      enclosureDepth++;
      out.push(tok);
      i++;
      continue;
    }
    if (CLOSERS.has(tok.text)) {
      enclosureDepth--;
      out.push(tok);
      i++;
      continue;
    }

    // Inside enclosures: skip newlines
    if (tok.type === "newline" && enclosureDepth > 0) {
      i++;
      continue;
    }

    // Newline outside enclosures: emit newline then handle indentation
    if (tok.type === "newline") {
      out.push(tok);
      i++;

      // Consume blank lines, comments, and whitespace to find the next
      // real token's indentation level.
      let indent = "";
      while (i < raw.length) {
        const next = raw[i];
        if (next.type === "ws") {
          indent = next.text;
          i++;
          continue;
        }
        if (next.type === "comment") {
          i++;
          // After a comment there must be a newline (or EOF).
          // Skip the newline too, then reset indent for the next line.
          if (i < raw.length && raw[i].type === "newline") {
            i++;
          }
          indent = "";
          continue;
        }
        if (next.type === "newline") {
          // Blank line — skip it, reset indent
          i++;
          indent = "";
          continue;
        }
        // Found a real token
        break;
      }

      // If we've hit EOF after newlines, just emit remaining dedents
      if (i >= raw.length) {
        const ref = raw[raw.length - 1];
        while (indentStack.length > 1) {
          indentStack.pop();
          out.push(syntheticToken("dedent", ref));
        }
        continue;
      }

      const currentIndent = indentStack[indentStack.length - 1];
      if (indent === currentIndent) {
        // Same level — nothing to do
      } else if (indent.startsWith(currentIndent) && indent.length > currentIndent.length) {
        // Deeper indent
        indentStack.push(indent);
        out.push(syntheticToken("indent", raw[i]));
      } else {
        // Dedent — pop until we find a matching level
        while (indentStack.length > 1 && indentStack[indentStack.length - 1] !== indent) {
          indentStack.pop();
          out.push(syntheticToken("dedent", raw[i]));
        }
        if (indentStack[indentStack.length - 1] !== indent) {
          throw new InconsistentDedentError(raw[i].line, raw[i].col);
        }
      }
      continue;
    }

    // Everything else: emit as-is
    out.push(tok);
    i++;
  }

  // EOF: emit remaining dedents
  if (indentStack.length > 1) {
    const ref =
      raw.length > 0
        ? raw[raw.length - 1]
        : ({
            toString: () => "",
            offset: 0,
            line: 1,
            col: 1,
          } as moo.Token);
    while (indentStack.length > 1) {
      indentStack.pop();
      out.push(syntheticToken("dedent", ref));
    }
  }

  return out;
}

// ── PythonLexer (Nearley-compatible wrapper) ───────────────────────────────

interface PythonLexerState extends moo.LexerState {
  pos: number;
}

class PythonLexer implements moo.Lexer {
  private tokens: moo.Token[] = [];
  private pos = 0;

  reset(data?: string, state?: moo.LexerState): this {
    if (state && "pos" in state) {
      this.pos = (state as PythonLexerState).pos;
    } else if (data !== undefined) {
      mooLexer.reset(data);
      const raw: moo.Token[] = [];
      let tok: moo.Token | undefined;
      while ((tok = mooLexer.next())) {
        raw.push(tok);
      }
      this.tokens = processTokens(raw);
      this.pos = 0;
    }
    return this;
  }

  next(): moo.Token | undefined {
    if (this.pos >= this.tokens.length) return undefined;
    return this.tokens[this.pos++];
  }

  save(): moo.LexerState {
    return { pos: this.pos } as unknown as moo.LexerState;
  }

  has(name: string): boolean {
    return name === "indent" || name === "dedent" || mooLexer.has(name);
  }

  formatError(token?: moo.Token, message?: string): string {
    return mooLexer.formatError(token as moo.Token, message);
  }

  pushState(state: string): void {
    mooLexer.pushState(state);
  }

  popState(): void {
    mooLexer.popState();
  }

  setState(state: string): void {
    mooLexer.setState(state);
  }

  [Symbol.iterator](): Iterator<moo.Token> {
    return {
      next: (): IteratorResult<moo.Token> => {
        const token = this.next();
        return { value: token as moo.Token, done: !token };
      },
    };
  }
}
const pythonLexer: moo.Lexer = new PythonLexer();
export default pythonLexer;
