/**
 * Moo lexer configuration for Python subset
 * This replaces the hand-written tokenizer
 */

import moo from "moo";
import IndentationLexer from "./moo-indentation-lexer";

// Use moo.keywords() so that identifier-prefixed keywords like 'in', 'is',
// 'or', 'and', 'not', 'def', 'for', etc. are only recognised when they
// appear as a complete identifier, never as prefixes of longer names.
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

// Define the Moo lexer rules
const mooLexer = moo.compile({
  // Whitespace and line handling
  newline: { match: /\n/, lineBreaks: true },
  ws: /[ \t]+/,

  // Comments
  comment: /#[^\n]*/,

  // Numbers — float and complex must come before bigint (longest-match ordering)
  complex: /(?:\d+\.?\d*|\.\d+)[jJ]/,
  float: /(?:\d+\.\d*|\.\d+)(?:[eE][+-]?\d+)?/,
  hex: /0[xX][0-9a-fA-F]+/,
  octal: /0[oO][0-7]+/,
  binary: /0[bB][01]+/,
  bigint: /\d+/,

  // Strings (triple-quoted must precede single-quoted)
  // Allow backslash followed by any character (Python keeps unrecognized escapes literally)
  stringTripleDouble: /"""(?:[^"\\]|\\.)*?"""/,
  stringTripleSingle: /'''(?:[^'\\]|\\.)*?'''/,
  stringDouble: /"(?:[^"\\]|\\.)*"/,
  stringSingle: /'(?:[^'\\]|\\.)*'/,

  // Multi-character operators (must come before single-char variants)
  doublestar: "**",
  doubleslash: "//",
  doubleequal: "==",
  notequal: "!=",
  lessequal: "<=",
  greaterequal: ">=",
  doublecolon: "::",
  ellipsis: "...",

  // Single-character operators and delimiters
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

  // Identifiers — reclassified as keywords via kwType when the value matches
  identifier: { match: /[a-zA-Z_][a-zA-Z0-9_]*/, type: kwType },
});

const pythonLexer = new IndentationLexer({
  lexer: mooLexer,
  indentationType: "ws",
  newlineType: "newline",
  commentType: "comment",
  indentName: "indent",
  dedentName: "dedent",
  enclosingPunctuations: { "[": "]", "(": ")", "{": "}" },
  separators: [","],
});

export default pythonLexer;
