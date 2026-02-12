/**
 * Moo lexer configuration for Python subset
 * This replaces the hand-written tokenizer
 */

import moo from 'moo';

// Track indentation state
let indentStack: number[] = [0];

export const lexer = moo.compile({
  // Whitespace and line handling
  newline: { match: /\n/, lineBreaks: true },
  ws: { match: /[ \t]+/ },
  
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

// Custom token type for indentation handling
export interface IndentToken {
  type: 'INDENT' | 'DEDENT';
  value: string;
  line: number;
  col: number;
}

/**
 * Wrapper around Moo lexer that handles Python indentation
 * This processes the token stream to inject INDENT/DEDENT tokens
 */
export class PythonLexer {
  private lexer: moo.Lexer;
  private tokenQueue: (moo.Token | IndentToken)[] = [];
  private indentStack: number[] = [0];
  private atLineStart: boolean = true;
  private pendingIndentation: number | null = null;
  private currentLineIndent: number = 0;
  private seenFirstToken: boolean = false;
  
  constructor() {
    this.lexer = lexer.reset();
  }
  
  reset(chunk?: string, state?: any) {
    // Add trailing newline if missing
    if (chunk && !chunk.endsWith('\n')) {
      chunk = chunk + '\n';
    }
    this.lexer.reset(chunk, state);
    this.tokenQueue = [];
    this.indentStack = [0];
    this.atLineStart = true;
    this.pendingIndentation = null;
    this.currentLineIndent = 0;
    this.seenFirstToken = false;
    return this;
  }
  
  next(): moo.Token | IndentToken | undefined {
    // Return queued tokens first
    if (this.tokenQueue.length > 0) {
      return this.tokenQueue.shift();
    }
    
    const token = this.lexer.next();
    
    if (!token) {
      // End of input - emit remaining DEDENTs, then EOF, then undefined
      if (this.indentStack.length > 1) {
        this.indentStack.pop();
        return {
          type: 'DEDENT',
          value: '',
          line: 0,
          col: 0
        };
      }
      // Return EOF token once, then undefined
      if (this.indentStack.length === 1) {
        this.indentStack.pop(); // Mark that we've returned EOF
        return {
          type: 'EOF',
          value: '',
          line: 0,
          col: 0
        } as any;
      }
      // After EOF, return undefined
      return undefined;
    }
    
    // Skip comments but NOT whitespace initially (we need to measure it)
    if (token.type === 'comment') {
      return this.next();
    }
    
    // Handle newlines and indentation
    if (token.type === 'newline') {
      this.atLineStart = true;
      this.currentLineIndent = 0;
      return token;
    }
    
    // At the start of a line, measure indentation
    if (this.atLineStart) {
      // Consume whitespace at line start to measure indentation
      if (token.type === 'ws') {
        this.currentLineIndent = token.value.length;
        return this.next(); // Skip the whitespace, continue to next token
      }
      
      // Now we have a real token (not whitespace), handle indentation
      this.atLineStart = false;
      const previousIndent = this.indentStack[this.indentStack.length - 1];
      
      if (this.currentLineIndent > previousIndent) {
        this.indentStack.push(this.currentLineIndent);
        this.tokenQueue.push(token);
        return {
          type: 'INDENT',
          value: '',
          line: token.line!,
          col: token.col!
        };
      } else if (this.currentLineIndent < previousIndent) {
        // Emit DEDENTs
        while (this.indentStack.length > 1 && this.indentStack[this.indentStack.length - 1] > this.currentLineIndent) {
          this.indentStack.pop();
          this.tokenQueue.push({
            type: 'DEDENT',
            value: '',
            line: token.line!,
            col: token.col!
          });
        }
        this.tokenQueue.push(token);
        return this.tokenQueue.shift();
      }
      // Reset for next line
      this.currentLineIndent = 0;
    }
    
    // Skip whitespace outside of line starts (it's just spacing)
    if (token.type === 'ws') {
      return this.next();
    }
    
    // Check for forbidden keywords
    if (token.type && token.type.startsWith('forbidden_')) {
      throw new Error(`Forbidden keyword: ${token.value} at line ${token.line}`);
    }
    
    return token;
  }
  
  save() {
    return {
      lexerState: this.lexer.save(),
      indentStack: [...this.indentStack],
      atLineStart: this.atLineStart
    };
  }
  
  formatError(token: moo.Token, message?: string) {
    return this.lexer.formatError(token, message);
  }
  
  has(tokenType: string) {
    // Special tokens produced by the wrapper
    if (tokenType === 'INDENT' || tokenType === 'DEDENT' || tokenType === 'EOF') {
      return true;
    }
    return this.lexer.has(tokenType);
  }
}

// Export a factory function for Nearley
export const pythonLexer = new PythonLexer();