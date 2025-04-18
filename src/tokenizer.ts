/*
* Full disclosure: The general structure of this file is adapted from my own
* Rust implementation of a scanner
* https://github.com/Fidget-Spinner/crafting_interpreters/blob/main/rust/src/scanner.rs.
* That is in turn is adapted from the Java code written by the excellent book,
* "Crafting Interpreters" https://craftinginterpreters.com/scanning.html.
* Said book's copyright is under Robert Nystrom.
* I've included the MIT license that code snippets from
* the book is licensed under down below. See
* https://github.com/munificent/craftinginterpreters/blob/master/LICENSE
*
* The changes I've made: I have rewritten basically everything from scratch.
* Only the method names and overall method APIs
* are the same. Their internal behaviors are quite different as the scanner
* in the book parses a JS-like language, not Python.
*
* - The book was written in Java. I have written this in TypeScript.
* - The scanner supports a whitespace significant language now.
* - Also added support for column numbers for better error messages in the future.
* - Also added better errors.
* - Also added forbidden identifiers.
*
*
    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to
    deal in the Software without restriction, including without limitation the
    rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
    sell copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
    IN THE SOFTWARE.
* */

import { TokenType } from "./tokens";
import { TokenizerErrors } from "./errors";

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
        this.indexInSource = indexInSource
    }
}

const specialIdentifiers = new Map([
    ["and", TokenType.AND],
    ["or", TokenType.OR],
    ["while", TokenType.WHILE],
    ["for", TokenType.FOR],
    ["None", TokenType.NONE],
    ["is", TokenType.IS],
    ["not", TokenType.NOT],
    ["pass", TokenType.PASS],
    ["def", TokenType.DEF],
    ["lambda", TokenType.LAMBDA],
    ["from", TokenType.FROM],
    ["True", TokenType.TRUE],
    ["False", TokenType.FALSE],
    ["break", TokenType.BREAK],
    ["continue", TokenType.CONTINUE],
    ["return", TokenType.RETURN],
    ["assert", TokenType.ASSERT],
    ["import", TokenType.IMPORT],
    ["global", TokenType.GLOBAL],
    ["nonlocal", TokenType.NONLOCAL],
    ["if", TokenType.IF],
    ["elif", TokenType.ELIF],
    ["else", TokenType.ELSE],
    ["in", TokenType.IN],
]);

export const SPECIAL_IDENTIFIER_TOKENS = Array.from(specialIdentifiers.values());


export class Tokenizer {
    private readonly source: string;
    private readonly tokens: Token[];
    private start: number;
    private current: number;
    private line: number;
    private col: number;
    private readonly indentStack: number[];
    private specialIdentifiers: Map<string, TokenType>;
    private forbiddenIdentifiers: Map<string, TokenType>;
    private parenthesesLevel: number;

    // forbiddenOperators: Set<TokenType>;
    constructor(source: string) {
        this.source = source;
        this.tokens = [];
        this.start = 0;
        this.current = 0;
        this.line = 0;
        this.col = 0;
        this.indentStack = [0];
        this.specialIdentifiers = specialIdentifiers;
        // Not used by us, but should be kept reserved as per Python spec
        this.forbiddenIdentifiers = new Map([
            ["async", TokenType.ASYNC],
            ["await", TokenType.AWAIT],
            ["yield", TokenType.YIELD],
            ["with", TokenType.WITH],
            ["del", TokenType.DEL],
            ["try", TokenType.TRY],
            ["except", TokenType.EXCEPT],
            ["finally", TokenType.FINALLY],
            ["raise", TokenType.RAISE],
        ]);
        // Operators that are valid in Python, but invalid for our use case.
        // this.forbiddenOperators = new Set([
        //     TokenType.AT,
        //     // Augmented assign e.g. *=
        //     TokenType.ATEQUAL,
        //     TokenType.PLUSEQUAL,
        //     TokenType.MINEQUAL,
        //     TokenType.STAREQUAL,
        //     TokenType.SLASHEQUAL,
        //     TokenType.PERCENTEQUAL,
        //     TokenType.AMPEREQUAL,
        //     TokenType.VBAREQUAL,
        //     TokenType.CIRCUMFLEXEQUAL,
        //     TokenType.LEFTSHIFTEQUAL,
        //     TokenType.RIGHTSHIFTEQUAL,
        //     TokenType.DOUBLESTAREQUAL,
        //     TokenType.DOUBLESLASHEQUAL,
        // ])
        this.parenthesesLevel = 0;
    }

    private isAtEnd() {
        return this.current >= this.source.length;
    }

    private advance() {
        const res = this.source[this.current];
        if (this.peek() == '\n') {
            this.line += 1;
        }
        this.current += 1;
        this.col += 1;
        return res;
    }

    private lexemeBuffer: string = "";

    private advanceString(record: boolean) {
        const res = this.source[this.current];
        if (this.peek() == '\n') {
            this.line += 1;
        }
        this.current += 1;
        this.col += 1;
        if (record) {
            this.lexemeBuffer += res;
        }
        return res;
    }

    private getBuffer() {
        console.info(this.lexemeBuffer);
    }

    private addBuffer(c: string) {
        this.lexemeBuffer += c;
    }

    private subtractBufferForThreeQuoteString(): boolean {
        if (this.lexemeBuffer.length >= 3) {
            this.lexemeBuffer = this.lexemeBuffer.slice(0, -3);
            return true;
        } else {
            return false;
        }
    }

    /* Single character lookahead. */
    private peek(): string {
        return this.isAtEnd() ? '\0' : this.source[this.current];
    }

    /* Double character lookahead. */

    private overwriteToken(type: TokenType) {
        const previousToken = this.tokens[this.tokens.length - 1];
        const lexeme = this.source.slice(previousToken.indexInSource, this.current);
        this.tokens[this.tokens.length - 1] = new Token(type, lexeme, previousToken.line, previousToken.col, previousToken.indexInSource);
    }

    private addToken(type: TokenType) {
        const line = this.line
        const col = this.col;
        const lexeme = this.source.slice(this.start, this.current);
        this.tokens.push(new Token(type, lexeme, line, col, this.current - lexeme.length))
    }

    private addStringToken(type: TokenType) {
        const line = this.line
        const col = this.col;
        // Remove starting and ending quotes when slicing
        // Ensures that string is parsed properly
        const lexeme = this.source.slice(this.start + 1, this.current - 1);
        this.tokens.push(new Token(type, this.lexemeBuffer, line, col, this.current - lexeme.length))
        this.lexemeBuffer = "";
    }

    private addMultiLineStringToken(type: TokenType) {
        const line = this.line
        const col = this.col;
        // Remove three starting and ending quotes when slicing
        const lexeme = this.source.slice(this.start + 3, this.current - 3);
        this.tokens.push(new Token(type, this.lexemeBuffer, line, col, this.current - lexeme.length))
        this.lexemeBuffer = "";
    }
    // Checks that the current character matches a pattern. If so the character is consumed, else nothing is consumed.
    private matches(pattern: string): boolean {
        if (this.isAtEnd()) {
            return false;
        } else {
            if (this.source[this.current] === pattern) {
                this.col += 1;
                this.current += 1;
                return true;
            }
            return false;
        }
    }

    private isLegalUnicode(c: string): boolean {
        if (this.isDelimiter(c)) {
            return false;
        }
        return c.length === 1 && !/^\p{Nd}$/u.test(c);
    }

    private isAlpha(c: string): boolean {
        return /^[A-Za-z]$/i.test(c);
    }

    private isDigit(c: string): boolean {
        return /^[0-9]/.test(c);
    }

    private isHexa(c: string): boolean {
        return /^[0-9A-F]$/i.test(c);
    }

    private isOcta(c: string): boolean {
        return /^[0-7]/.test(c);
    }

    private isBinary(c: string): boolean {
        return /^[0-1]/.test(c);
    }

    // TODO: unicode
    private isIdentifier(c: string): boolean {
        if (/\s/.test(c)) {
            return false;
        }
        return c === '_' || this.isAlpha(c) || this.isDigit(c) || this.isLegalUnicode(c);
    }

    private isDelimiter(c: string): boolean {
        return /[\p{P}\p{S}]/u.test(c);
    }

    private baseNumber() {
        switch (this.peek()) {
            case 'x':
                this.advance();
                if (!this.isHexa(this.peek())) {
                    throw new TokenizerErrors.InvalidNumberError(this.line, this.col, this.source, this.start, this.current);
                }
                while (this.isHexa(this.peek())) {
                    this.advance();
                }
                this.addToken(TokenType.BIGINT);
                break;
            case 'o':
                this.advance();
                if (!this.isOcta(this.peek())) {
                    throw new TokenizerErrors.InvalidNumberError(this.line, this.col, this.source, this.start, this.current);
                }
                while (this.isOcta(this.peek())) {
                    this.advance();
                }
                this.addToken(TokenType.BIGINT);
                break;
            case 'b':
                this.advance();
                if (!this.isBinary(this.peek())) {
                    throw new TokenizerErrors.InvalidNumberError(this.line, this.col, this.source, this.start, this.current);
                }
                while (this.isBinary(this.peek())) {
                    this.advance();
                }
                this.addToken(TokenType.BIGINT);
                break;
            default:
                while (this.isDigit(this.peek())) {
                    this.advance();
                }
                
                if (this.peek() !== '.' && this.peek() !== 'e') {
                    // if ends with j and J then complex number
                    if (this.peek() === 'j' || this.peek() === 'J') {
                        this.advance();
                        this.addToken(TokenType.COMPLEX);
                        return;
                    }
                    
                    this.addToken(TokenType.BIGINT);
                    return;
                }
                
                if (this.peek() === '.') {
                    this.advance();
                    if (this.peek() === '_') {
                        // TODO:
                        // throw new error
                        throw new Error('_ after .');
                    }
                    while (this.isDigit(this.peek())) {
                        this.advance();
                    }
                }

                if (this.peek() === '_') {
                    this.advance();
                }
                
                if (this.peek() === 'e') {
                    this.advance();
                    if (this.peek() === '-') {
                        this.advance();
                    }
                    if (this.peek() === '+') {
                        this.advance();
                    }
                    if (!this.isDigit(this.peek())) {
                        throw new TokenizerErrors.InvalidNumberError(this.line, this.col, this.source, this.start, this.current);
                    }
                    while (this.isDigit(this.peek())) {
                        this.advance();
                    }
                }
        
                // if ends with j and J then complex number
                if (this.peek() === 'j' || this.peek() === 'J') {
                    this.advance();
                    this.addToken(TokenType.COMPLEX);
                } else {
                    this.addToken(TokenType.NUMBER);
                }
        }
    }

    private number(c: string) {
        while ((this.isDigit(this.peek()) || this.peek() === '_') && c !== '.') {
            if (this.peek() === '_') {
                this.advance();
                if (!this.isDigit(this.peek())) {
                    throw new Error("Invalid use of underscore in number");
                }
            } else {
                this.advance();
            }
        }

        if (this.peek() !== '.' && this.peek() !== 'e' && c !== '.') {
            // if ends with j and J then complex number
            if (this.peek() === 'j' || this.peek() === 'J') {
                this.advance();
                this.addToken(TokenType.COMPLEX);
                return;
            }

            this.addToken(TokenType.BIGINT);
            return;
        }

        // Fractional part
        if ((this.peek() === '.' && c !== '.') || (this.peek() !== '.' && c === '.')) {
            this.advance();
            if (this.peek() === '_') {
                // TODO:
                // throw new error
                throw new Error('_ after .');
            }
            while (this.isDigit(this.peek()) || this.peek() === '_') {
                if (this.peek() === '_') {
                    this.advance();
                    if (!this.isDigit(this.peek())) {
                        throw new Error("Invalid use of underscore in number");
                    }
                } else {
                    this.advance();
                }
            }
        }

        // Exponent part
        if (this.peek() === 'e') {
            this.advance();
            if (this.peek() === '-') {
                this.advance();
            }
            if (this.peek() === '+') {
                this.advance();
            }
            if (!this.isDigit(this.peek())) {
                throw new TokenizerErrors.InvalidNumberError(this.line, this.col, this.source, this.start, this.current);
            }
            while (this.isDigit(this.peek()) || this.peek() === '_') {
                if (this.peek() === '_') {
                    this.advance();
                    if (!this.isDigit(this.peek())) {
                        throw new Error("Invalid use of underscore in number");
                    }
                } else {
                    this.advance();
                }
            }
        }

        // if ends with j and J then complex number
        if (this.peek() === 'j' || this.peek() === 'J') {
            this.advance();
            this.addToken(TokenType.COMPLEX);
        } else {
            this.addToken(TokenType.NUMBER);
        }
        //this.addToken(TokenType.NUMBER);
    }

    private name() {
        while (this.isIdentifier(this.peek())) {
            this.advance();
        }
        const identifier = this.source.slice(this.start, this.current);
        if (!!this.forbiddenIdentifiers.get(identifier)) {
            throw new TokenizerErrors.ForbiddenIdentifierError(this.line, this.col,
                this.source, this.start);
        }
        const specialIdent = this.specialIdentifiers.get(identifier);
        if (specialIdent !== undefined) {
            /* Merge multi-token operators, like 'is not', 'not in' */
            const previousToken = this.tokens[this.tokens.length - 1];
            switch (specialIdent) {
                case TokenType.NOT:
                    if (previousToken.type === TokenType.IS) {
                        this.overwriteToken(TokenType.ISNOT);
                    } else {
                        this.addToken(specialIdent);
                    }
                    return;
                case TokenType.IN:
                    if (previousToken.type === TokenType.NOT) {
                        this.overwriteToken(TokenType.NOTIN);
                    } else {
                        this.addToken(specialIdent);
                    }
                    return;
                default:
                    this.addToken(specialIdent);
            }
        } else {
            this.addToken(TokenType.NAME);
        }
    }

    private scanToken() {
        const c = this.advance();
        // KJ: I really hope the JS runtime optimizes this to a jump table...
        switch (c) {
            //// SPECIAL MARKERS
            // Comment -- advance to end of line.
            case '#':
                while ((this.peek() !== '\n' && this.peek() !== '\r') && !this.isAtEnd()) {
                    this.advance();
                }
                break;
            case ':':
                this.addToken(this.matches(':') ? TokenType.DOUBLECOLON : TokenType.COLON);
                break;
            // All non-significant whitespace
            case ' ':
                break;
            // CR LF on Windows
            case '\r':
                if (this.matches('\n')) {
                    // fall through
                } else {
                    break;
                }
            case '\n':
                if (this.parenthesesLevel > 0) {
                    this.line += 1;
                    this.col = 0;
                    break;
                }
                this.addToken(TokenType.NEWLINE);
                this.line += 1;
                this.col = 0;
                let accLeadingWhiteSpace = 0;
                // Detect significant whitespace
                while (this.peek() === " " && !this.isAtEnd()) {
                    accLeadingWhiteSpace += 1;
                    // Consume the rest of the line's leading whitespace.
                    this.advance();
                }
                // Handles comments
                if (this.peek() === "#") {
                    while ((this.peek() !== '\n' && this.peek() !== '\r') && !this.isAtEnd()) {
                        this.advance();
                    }
                }
                // The following block handles things like
                /*
                def foo():
                    pass
                             <---- this newline should be zapped
                    pass     <---- this should be part of the block
                 */
                while ((this.peek() === "\n" || this.peek() === "\r") && !this.isAtEnd()) {
                    // Handle \r\n on Windows
                    if (this.peek() === "\r") {
                        this.advance();
                        if (this.peek() === "\n") {
                            this.advance();
                        }
                    } else {
                        this.advance();
                    }
                    this.line += 1;
                    this.col = 0;
                    accLeadingWhiteSpace = 0;
                    // Detect significant whitespace
                    while (this.peek() === " " && !this.isAtEnd()) {
                        accLeadingWhiteSpace += 1;
                        // Consume the rest of the line's leading whitespace.
                        this.advance();
                    }
                }
                if (accLeadingWhiteSpace % 4 !== 0) {
                    throw new TokenizerErrors.NonFourIndentError(this.line, this.col, this.source, this.current);
                }
                const tos = this.indentStack[this.indentStack.length - 1];
                if (accLeadingWhiteSpace > tos) {
                    this.indentStack.push(accLeadingWhiteSpace);
                    const indents = Math.floor((accLeadingWhiteSpace - tos) / 4);
                    for (let i = 0; i < indents; ++i) {
                        this.addToken(TokenType.INDENT);
                    }
                } else if (accLeadingWhiteSpace < tos) {
                    if (this.indentStack.length == 0) {
                        throw new TokenizerErrors.InconsistentIndentError(this.line, this.col, this.source, this.current);
                    }
                    const prev = this.indentStack[this.indentStack.length - 1];
                    if (prev === undefined || prev === null) {
                        throw new TokenizerErrors.InconsistentIndentError(this.line, this.col, this.source, this.current);
                    }
                    const indents = Math.floor((prev - accLeadingWhiteSpace) / 4);
                    for (let i = 0; i < indents; ++i) {
                        this.indentStack.pop();
                        this.addToken(TokenType.DEDENT);
                    }
                }
                break;
            // String
            case '"':
            case "'":
                let quote = c;
                if (this.peek() == quote) { // handle multi-line string
                    this.advance(); // second quote found and consumed
                    if (this.peek() != quote) { // empty string ""
                        this.addStringToken(TokenType.STRING);
                        break;
                    }
                    this.advance(); // third quote consumed
                    let quote_sum = 0;
                    while (true) {
                        while (this.peek() != quote && !this.isAtEnd()) {
                            quote_sum = 0;
                            if (this.peek() === '\\') {
                                this.advanceString(false);
                                switch(this.peek()) {
                                    case '\n':
                                        break;
                                    case '\\':
                                        this.addBuffer('\\');
                                        break;
                                    case '\'':
                                        this.addBuffer('\'');
                                        break;
                                    case '\"':
                                        this.addBuffer('\"');
                                        break;
                                    case 'a':
                                        this.addBuffer('\a');
                                        break;
                                    case 'b':
                                        this.addBuffer('\b');
                                        break;
                                    case 'f':
                                        this.addBuffer('\f');
                                        break;
                                    case 'n':
                                        this.addBuffer('\n');
                                        break;
                                    case 'r':
                                        this.addBuffer('\r');
                                        break;
                                    case 't':
                                        this.addBuffer('\t');
                                        break;
                                    case 'v':
                                        this.addBuffer('\v');
                                        break;
                                    default:
                                        throw new Error("SyntaxWarning: invalid escape sequence");
                                }
                                this.advanceString(false);
                            } else {
                                this.advanceString(true);
                            }
                            //this.advance(); // advance until ending quote found
                        }
                        if (this.isAtEnd()) {
                            throw new TokenizerErrors.UnterminatedStringError(this.line,
                                this.col, this.source, this.start, this.current);
                        }
                        if (this.peek() == quote) {
                            this.advanceString(true);
                            quote_sum++;
                        }
                        //this.advance(); // consume first ending quote
                        // if (this.peek() != quote) {
                        //     throw new TokenizerErrors.UnterminatedStringError(this.line,
                        //         this.col, this.source, this.start, this.current);
                        // }
                        // this.advance();
                        if (quote_sum === 3) {
                            this.subtractBufferForThreeQuoteString();
                            // console.info('endof3quote');
                            // this.getBuffer();
                            break;
                        }
                    }
                    
                    // // consume second ending quote
                    // if (this.peek() != quote) {
                    //     throw new TokenizerErrors.UnterminatedStringError(this.line,
                    //         this.col, this.source, this.start, this.current);
                    // }
                    // this.advance(); // consume third ending quote
                    this.addMultiLineStringToken(TokenType.STRING);
                } else { // other case, single-line string
                    while (this.peek() !== quote && this.peek() !== '\n' && !this.isAtEnd()) {
                        if (this.peek() === '\\') {
                            this.advanceString(false);
                            switch(this.peek()) {
                                case '\n':
                                    break;
                                case '\\':
                                    this.addBuffer('\\');
                                    break;
                                case '\'':
                                    this.addBuffer('\'');
                                    break;
                                case '\"':
                                    this.addBuffer('\"');
                                    break;
                                case 'a':
                                    this.addBuffer('\a');
                                    break;
                                case 'b':
                                    this.addBuffer('\b');
                                    break;
                                case 'f':
                                    this.addBuffer('\f');
                                    break;
                                case 'n':
                                    this.addBuffer('\n');
                                    break;
                                case 'r':
                                    this.addBuffer('\r');
                                    break;
                                case 't':
                                    this.addBuffer('\t');
                                    break;
                                case 'v':
                                    this.addBuffer('\v');
                                    break;
                                default:
                                    throw new Error("SyntaxWarning: invalid escape sequence");
                            }
                            this.advanceString(false);
                        } else {
                            this.advanceString(true);
                        }
                    }
                    // should look for \\
                    if (this.peek() === '\n' || this.isAtEnd()) {
                        throw new TokenizerErrors.UnterminatedStringError(this.line, this.col, this.source, this.start, this.current);
                    }
                    // Consume Closing "
                    this.advance();
                    this.addStringToken(TokenType.STRING);
                }
                break;
            // Number... I wish JS had match statements :(
            case '0':
                this.baseNumber();
                break;
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
            case '8':
            case '9':
            case '.':
                this.number(c);
                break;
            //// Everything else
            case '(':
                this.addToken(TokenType.LPAR);
                this.parenthesesLevel++;
                break;
            case ')':
                this.addToken(TokenType.RPAR);
                if (this.parenthesesLevel === 0) {
                    throw new TokenizerErrors.NonMatchingParenthesesError(this.line, this.col, this.source, this.current);
                }
                this.parenthesesLevel--;
                break;
            case ',':
                this.addToken(TokenType.COMMA);
                break;
            //// OPERATORS
            case '-':
                if (this.matches('=')) {
                    this.raiseForbiddenOperator();
                }
                this.addToken(TokenType.MINUS);
                break;
            case '+':
                if (this.matches('=')) {
                    this.raiseForbiddenOperator();
                }
                this.addToken(TokenType.PLUS);
                break;
            case '*':
                if (this.matches('=')) {
                    this.raiseForbiddenOperator();
                }
                this.addToken(this.matches('*') ? TokenType.DOUBLESTAR : TokenType.STAR);
                break;
            case '/':
                if (this.matches('=')) {
                    this.raiseForbiddenOperator();
                }
                this.addToken(this.matches('/') ? TokenType.DOUBLESLASH : TokenType.SLASH);
                break;
            case '%':
                if (this.matches('=')) {
                    this.raiseForbiddenOperator();
                }
                this.addToken(TokenType.PERCENT);
                break;
            case '!':
                this.addToken(this.matches('=') ? TokenType.NOTEQUAL : TokenType.BANG);
                break;
            case '=':
                this.addToken(this.matches('=') ? TokenType.DOUBLEEQUAL : TokenType.EQUAL);
                break;
            case '<':
                this.addToken(this.matches('=') ? TokenType.LESSEQUAL : TokenType.LESS);
                break;
            case '>':
                this.addToken(this.matches('=') ? TokenType.GREATEREQUAL : TokenType.GREATER);
                break;
            default:
                // Identifier start
                // TODO: unicode
                if (c === '_' || this.isAlpha(c) || this.isLegalUnicode(c)) {
                    this.name();
                    break;
                }
                this.matchForbiddenOperator(c);
                throw new TokenizerErrors.UnknownTokenError(c, this.line, this.col, this.source, this.current);
        }
    }

    private matchForbiddenOperator(ch: string) {
        switch (ch) {
            case '@':
            case '|':
            case '&':
            case '~':
            case '^':
                this.matches('=');
                this.raiseForbiddenOperator();
                break;
            default:
                break;
        }
    }

    scanEverything(): Token[] {
        while (!this.isAtEnd()) {
            this.start = this.current;
            this.scanToken();
        }
        // Unravel the indent stack
        while (this.indentStack[this.indentStack.length - 1] !== 0) {
            this.indentStack.pop();
            this.addToken(TokenType.DEDENT);
        }
        this.tokens.push(new Token(TokenType.ENDMARKER, "", this.line, this.col, this.current));
        return this.tokens
    }

    printTokens() {
        for (const token of this.tokens) {
            console.log(`${token.indexInSource}:${token.line}-${token.line},${token.indexInSource + token.lexeme.length}\t\t\t\
            ${TokenType[token.type]}\t\t\t'${token.lexeme}'`);
        }
    }

    private raiseForbiddenOperator() {
        throw new TokenizerErrors.ForbiddenOperatorError(this.line, this.col, this.source, this.start, this.current);
    }
}

