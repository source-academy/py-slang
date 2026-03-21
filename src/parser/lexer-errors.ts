/**
 * Indentation errors for the Moo-based lexer.
 * Messages follow CPython wording for familiarity.
 */

export class UnexpectedIndentError extends SyntaxError {
  line: number;
  col: number;
  constructor(line: number, col: number) {
    super(`IndentationError at line ${line}: unexpected indent`);
    this.line = line;
    this.col = col;
    this.name = "UnexpectedIndentError";
  }
}

export class InconsistentDedentError extends SyntaxError {
  line: number;
  col: number;
  constructor(line: number, col: number) {
    super(
      `IndentationError at line ${line}: unindent does not match any outer indentation level`,
    );
    this.line = line;
    this.col = col;
    this.name = "InconsistentDedentError";
  }
}
