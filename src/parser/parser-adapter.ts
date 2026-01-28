/**
 * Adapter for Nearley parser to match the interface of the old hand-written parser
 */

import nearley from 'nearley';
import pythonLexer from './lexer';
import grammar from './python-grammar';

/**
 * NearleyParser - Drop-in replacement for the old Parser class
 */
export class NearleyParser {
  private readonly source: string;
  
  constructor(source: string, tokens?: any[]) {
    // Note: Nearley doesn't use pre-tokenized input in the same way
    // The lexer is integrated into the parser
    this.source = source;
  }
  
  /**
   * Parse the source code and return the AST
   */
  parse(): any {
    // Create a new parser instance with our grammar
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled({
      ...grammar,
      Lexer: pythonLexer as nearley.Lexer
    }));
    
    try {
      // Feed the source code to the parser
      parser.feed(this.source);
      
      // Check if we got results
      if (parser.results.length === 0) {
        throw new Error('Unexpected end of input - no parse results');
      }
      
      // Check for ambiguous grammar (multiple parse trees)
      if (parser.results.length > 1) {
        console.warn(`Ambiguous grammar: ${parser.results.length} possible parses`);
      }
      
      // Return the first (or only) parse result
      return parser.results[0];
      
    } catch (error: any) {
      // Transform Nearley errors to match our error format
      if (error.token) {
        const token = error.token;
        const line = token.line || 0;
        const col = token.col || 0;
        throw new ParseError(
          `Unexpected token: ${token.value || token.type} at line ${line}, column ${col}`,
          line,
          col,
          this.source
        );
      }
      throw error;
    }
  }
}

/**
 * Error class for parse errors
 */
export class ParseError extends SyntaxError {
  line: number;
  col: number;
  source: string;
  
  constructor(message: string, line: number, col: number, source: string) {
    super(message);
    this.name = 'ParseError';
    this.line = line;
    this.col = col;
    this.source = source;
  }
}

/**
 * Convenience function to parse Python source code
 */
export function parse(source: string): any {
  const parser = new NearleyParser(source);
  return parser.parse();
}

