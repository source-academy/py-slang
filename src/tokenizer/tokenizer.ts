import { TokenType } from "../tokens";

/**
 * Represents a token produced by the lexer.
 */
export class Token {
  /**
   * The type of the token (e.g., `TokenType.NAME`, `TokenType.NUMBER`, etc.)
   */
  type: TokenType;

  /**
   * The string value of the token as it appears in the source code (e.g., for a token representing the number `42`, the lexeme would be the string `"42"`).
   */
  lexeme: string;

  /**
   * The line number where the token appears in the source code (1-based).
   */
  line: number;

  /**
   * The column number where the token starts in the source code (0-based).
   */
  col: number;

  /**
   * The index of the token in the source code (0-based).
   */
  indexInSource: number;

  constructor(type: TokenType, lexeme: string, line: number, col: number, indexInSource: number) {
    this.type = type;
    this.lexeme = lexeme;
    this.line = line;
    this.col = col;
    this.indexInSource = indexInSource;
  }
}
