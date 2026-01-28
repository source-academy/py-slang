/**
 * Moo lexer configuration for Python subset
 * This replaces the hand-written tokenizer
 */

import moo from 'moo';
import IndentationLexer from './moo-indentation-lexer';

// Define the Moo lexer rules
const mooLexer = moo.compile({
  // Whitespace and line handling
  newline: { match: /\n/, lineBreaks: true },
  ws: /[ \t]+/,
  
  // Comments
  comment: /#[^\n]*/,
  
  // Numbers
  complex: /(?:\d+\.?\d*|\.\d+)[jJ]/,
  bigint: /\d+/,
  float: /(?:\d+\.\d*|\.\d+)(?:[eE][+-]?\d+)?/,
  
  // Strings (simplified - doesn't handle all edge cases yet)
  stringTripleDouble: /"""(?:[^"\\]|\\["\\/bfnrt]|\\u[a-fA-F0-9]{4})*?"""/,
  stringTripleSingle: /'''(?:[^'\\]|\\['\\/bfnrt]|\\u[a-fA-F0-9]{4})*?'''/,
  stringDouble: /"(?:[^"\\]|\\["\\/bfnrt]|\\u[a-fA-F0-9]{4})*?"/,
  stringSingle: /'(?:[^'\\]|\\['\\/bfnrt]|\\u[a-fA-F0-9]{4})*?'/,
  
  // Keywords (must come before identifier)
  kw_def: 'def',
  kw_if: 'if',
  kw_elif: 'elif',
  kw_else: 'else',
  kw_while: 'while',
  kw_for: 'for',
  kw_in: 'in',
  kw_return: 'return',
  kw_pass: 'pass',
  kw_break: 'break',
  kw_continue: 'continue',
  kw_and: 'and',
  kw_or: 'or',
  kw_not: 'not',
  kw_is: 'is',
  kw_lambda: 'lambda',
  kw_from: 'from',
  kw_import: 'import',
  kw_global: 'global',
  kw_nonlocal: 'nonlocal',
  kw_assert: 'assert',
  kw_True: 'True',
  kw_False: 'False',
  kw_None: 'None',
  
  // Forbidden keywords (for error reporting)
  forbidden_async: 'async',
  forbidden_await: 'await',
  forbidden_yield: 'yield',
  forbidden_with: 'with',
  forbidden_del: 'del',
  forbidden_try: 'try',
  forbidden_except: 'except',
  forbidden_finally: 'finally',
  forbidden_raise: 'raise',
  forbidden_class: 'class',
  
  // Multi-character operators
  doublestar: '**',
  doubleslash: '//',
  doubleequal: '==',
  notequal: '!=',
  lessequal: '<=',
  greaterequal: '>=',
  doublecolon: '::',
  ellipsis: '...',
  
  // Single character operators and delimiters
  lparen: '(',
  rparen: ')',
  lsqb: '[',
  rsqb: ']',
  lbrace: '{',
  rbrace: '}',
  colon: ':',
  comma: ',',
  plus: '+',
  minus: '-',
  star: '*',
  slash: '/',
  percent: '%',
  less: '<',
  greater: '>',
  equal: '=',
  dot: '.',
  semi: ';',
  
  // Identifiers (must come after keywords)
  identifier: /[a-zA-Z_][a-zA-Z0-9_]*/,
});

const pythonLexer = new IndentationLexer({
    lexer: mooLexer,
    indentationType: 'ws',
    newlineType: 'newline',
    commentType: 'comment',
    indentName: 'indent',
    dedentName: 'dedent',
    enclosingPunctuations: { '[': ']', '(': ')', '{': '}' },   // defaults {}, () and []
    separators: [',']  // defaults to , : ;
})

export default pythonLexer;