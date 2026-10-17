/**
 * Error class for parse errors. In a module of its own, so that the grammar (whose rules check what
 * a grammar cannot express, like the order of arguments) and the adapter can both use it.
 */
export class ParseError extends SyntaxError {
  line: number;
  col: number;
  source: string;

  constructor(message: string, line: number, col: number, source: string) {
    super(message);
    this.name = "ParseError";
    this.line = line;
    this.col = col;
    this.source = source;
  }
}
