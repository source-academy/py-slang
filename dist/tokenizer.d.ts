import { TokenType } from "./tokens";
export declare class Token {
    type: TokenType;
    lexeme: string;
    line: number;
    col: number;
    indexInSource: number;
    constructor(type: TokenType, lexeme: string, line: number, col: number, indexInSource: number);
}
export declare const SPECIAL_IDENTIFIER_TOKENS: TokenType[];
export declare class Tokenizer {
    private readonly source;
    private readonly tokens;
    private start;
    private current;
    private line;
    private col;
    private readonly indentStack;
    private specialIdentifiers;
    private forbiddenIdentifiers;
    private parenthesesLevel;
    constructor(source: string);
    private isAtEnd;
    private advance;
    private lexemeBuffer;
    private advanceString;
    private getBuffer;
    private addBuffer;
    private subtractBufferForThreeQuoteString;
    private peek;
    private overwriteToken;
    private addToken;
    private addStringToken;
    private addMultiLineStringToken;
    private matches;
    private isLegalUnicode;
    private isAlpha;
    private isDigit;
    private isHexa;
    private isOcta;
    private isBinary;
    private isIdentifier;
    private isDelimiter;
    private baseNumber;
    private number;
    private name;
    private scanToken;
    private matchForbiddenOperator;
    scanEverything(): Token[];
    printTokens(): void;
    private raiseForbiddenOperator;
}
