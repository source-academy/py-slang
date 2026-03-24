import { TokenType } from "../tokens";

export class Token {
  type: TokenType;
  lexeme: string;
  line: number;
  col: number;
  indexInSource: number;

  constructor(type: TokenType, lexeme: string, line: number, col: number, indexInSource: number) {
    this.type = type;
    this.lexeme = lexeme;
    this.line = line;
    this.col = col;
    this.indexInSource = indexInSource;
  }
}
