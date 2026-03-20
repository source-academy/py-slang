import { Token } from "../tokenizer/tokenizer";
import { TokenType } from "../tokens";

const MOO_TO_TOKEN_TYPE: Record<string, TokenType> = {
  name: TokenType.NAME,
  number_float: TokenType.NUMBER,
  number_hex: TokenType.BIGINT,
  number_oct: TokenType.BIGINT,
  number_bin: TokenType.BIGINT,
  number_int: TokenType.BIGINT,
  number_complex: TokenType.COMPLEX,
  string_triple_double: TokenType.STRING,
  string_triple_single: TokenType.STRING,
  string_double: TokenType.STRING,
  string_single: TokenType.STRING,
  newline: TokenType.NEWLINE,
  indent: TokenType.INDENT,
  dedent: TokenType.DEDENT,
  kw_if: TokenType.IF,
  kw_else: TokenType.ELSE,
  kw_elif: TokenType.ELIF,
  kw_while: TokenType.WHILE,
  kw_for: TokenType.FOR,
  kw_in: TokenType.IN,
  kw_def: TokenType.DEF,
  kw_return: TokenType.RETURN,
  kw_pass: TokenType.PASS,
  kw_break: TokenType.BREAK,
  kw_continue: TokenType.CONTINUE,
  kw_lambda: TokenType.LAMBDA,
  kw_None: TokenType.NONE,
  kw_True: TokenType.TRUE,
  kw_False: TokenType.FALSE,
  kw_and: TokenType.AND,
  kw_or: TokenType.OR,
  kw_not: TokenType.NOT,
  kw_is: TokenType.IS,
  kw_from: TokenType.FROM,
  kw_import: TokenType.IMPORT,
  kw_global: TokenType.GLOBAL,
  kw_nonlocal: TokenType.NONLOCAL,
  kw_assert: TokenType.ASSERT,
  doublestar: TokenType.DOUBLESTAR,
  doubleslash: TokenType.DOUBLESLASH,
  doubleequal: TokenType.DOUBLEEQUAL,
  notequal: TokenType.NOTEQUAL,
  lessequal: TokenType.LESSEQUAL,
  greaterequal: TokenType.GREATEREQUAL,
  doublecolon: TokenType.DOUBLECOLON,
  lparen: TokenType.LPAR,
  rparen: TokenType.RPAR,
  lsqb: TokenType.LSQB,
  rsqb: TokenType.RSQB,
  colon: TokenType.COLON,
  comma: TokenType.COMMA,
  plus: TokenType.PLUS,
  minus: TokenType.MINUS,
  star: TokenType.STAR,
  slash: TokenType.SLASH,
  percent: TokenType.PERCENT,
  less: TokenType.LESS,
  greater: TokenType.GREATER,
  equal: TokenType.EQUAL,
};

export function toAstToken(mooToken: {
  type?: string;
  value?: string;
  line?: number;
  col?: number;
  offset?: number;
}): Token {
  const type =
    mooToken.type !== undefined
      ? (MOO_TO_TOKEN_TYPE[mooToken.type] ?? TokenType.NAME)
      : TokenType.NAME;
  // Moo uses 1-based line, 1-based col, 0-based offset
  return new Token(
    type,
    mooToken.value ?? "",
    mooToken.line ?? 0,
    mooToken.col ?? 0,
    mooToken.offset ?? 0,
  );
}
