// Updated moo-indentation-lexer to TypeScript
// Original implementation here: https://github.com/aliclark/moo-indentation-lexer/tree/master
import * as moo from 'moo';
import MooPeekableLexer from 'moo-peekable-lexer';

interface PeekableLexer extends moo.Lexer {
    peek(): moo.Token | undefined;
    clone(): PeekableLexer;
}

interface IndentationToken extends moo.Token {
    indentation?: string;
}

interface Enclosure {
    opening: string;
    indentationLevel: string;
}

interface IndentationLexerState extends moo.LexerState {
    enclosures: Enclosure[];
    indentations: string[];
    queuedTokens: moo.Token[];
    queuedLines: moo.Token[][];
    lastToken: moo.Token | null;
    lexerInfo: moo.LexerState;
}

interface IndentationLexerOptions {
    lexer: moo.Lexer | PeekableLexer;
    indentationType?: string | null;
    newlineType?: string | null;
    commentType?: string | null;
    indentName?: string;
    dedentName?: string;
    enclosingPunctuations?: Record<string, string>;
    separators?: string[];
    state?: string;
    enclosures?: Enclosure[];
    indentations?: string[];
    queuedTokens?: moo.Token[];
    queuedLines?: moo.Token[][];
    lastToken?: moo.Token | null;
}

function invert(object: Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key in object) {
        result[object[key]] = key;
    }
    return result;
}

class LexerIterator implements Iterator<moo.Token> {
    private _lexer: IndentationLexer;

    constructor(lexer: IndentationLexer) {
        this._lexer = lexer;
    }

    next(): IteratorResult<moo.Token> {
        const token = this._lexer.next();
        return { value: token as moo.Token, done: !token };
    }

    [Symbol.iterator](): Iterator<moo.Token> {
        return this;
    }
}

const nonTab = /[^\t]/;

class IndentationLexer implements moo.Lexer {
    private _lexer: PeekableLexer;
    private _indentationType: string | null;
    private _newlineType: string | null;
    private _commentType: string | null;
    private _indentName: string;
    private _dedentName: string;
    private _enclosingPunctuations: Record<string, string>;
    private _separators: string[];
    private _state: string;
    private _enclosures: Enclosure[];
    private _indentations: string[];
    private _queuedTokens: moo.Token[];
    private _queuedLines: moo.Token[][];
    private _lastToken: moo.Token | null;
    private _startingPunctuations: string[];
    private _closingPunctuations: string[];
    private _matching: Record<string, string>;

    constructor({
        lexer,
        indentationType,
        newlineType,
        commentType,
        indentName,
        dedentName,
        enclosingPunctuations,
        separators,
        state,
        enclosures,
        indentations,
        queuedTokens,
        queuedLines,
        lastToken
    }: IndentationLexerOptions) {
        this._lexer = this._isPeekable(lexer) ? lexer : this._makePeekableLexer(lexer);
        this._indentationType = indentationType ?? null;
        this._newlineType = newlineType ?? null;
        this._commentType = commentType ?? null;
        this._indentName = indentName ?? 'indent';
        this._dedentName = dedentName ?? 'dedent';
        this._enclosingPunctuations = enclosingPunctuations ?? { '{': '}', '(': ')', '[': ']' };
        this._separators = separators ?? [',', ':', ';'];
        this._state = state ?? 'lineStart';
        this._enclosures = enclosures ?? [];
        this._indentations = indentations ?? [''];
        this._queuedTokens = queuedTokens ?? [];
        this._queuedLines = queuedLines ?? [];
        this._lastToken = lastToken ?? null;

        this._startingPunctuations = Object.keys(this._enclosingPunctuations);
        this._closingPunctuations = Object.values(this._enclosingPunctuations);
        this._matching = invert(this._enclosingPunctuations);
    }

    private _isPeekable(lexer: moo.Lexer | PeekableLexer): lexer is PeekableLexer {
        return 'peek' in lexer && typeof lexer.peek === 'function';
    }

    private _makePeekableLexer(lexer: moo.Lexer): PeekableLexer {
        return new MooPeekableLexer({ lexer });
    }

    reset(data?: string, info?: IndentationLexerState): this {
        this._state = info ? info.state : 'lineStart';
        this._enclosures = info ? [...info.enclosures] : [];
        this._indentations = info ? [...info.indentations] : [''];
        this._queuedTokens = info ? [...info.queuedTokens] : [];
        this._queuedLines = info ? [...info.queuedLines] : [];
        this._lastToken = info ? info.lastToken : null;
        this._lexer.reset(data, info?.lexerInfo);
        return this;
    }

    save(): IndentationLexerState {
        const lexerInfo = this._lexer.save();
        return {
            line: lexerInfo.line,
            col: lexerInfo.col,
            state: this._state,
            enclosures: [...this._enclosures],
            indentations: [...this._indentations],
            queuedTokens: [...this._queuedTokens],
            queuedLines: [...this._queuedLines],
            lastToken: this._lastToken,
            lexerInfo
        };
    }

    setState(state: string): void {
        this._lexer.setState(state);
    }

    popState(): void {
        this._lexer.popState();
    }

    pushState(state: string): void {
        this._lexer.pushState(state);
    }

    private _getToken(): moo.Token | undefined {
        const token = this._lexer.next();
        if (!token) {
            return token;
        }
        this._lastToken = token;
        return this._lastToken;
    }

    private _isIndentation(token: moo.Token | undefined): boolean {
        return !!token &&
            (this._indentationType === null
                ? !!token.text && !nonTab.test(token.text)
                : token.type === this._indentationType);
    }

    private _isNewline(token: moo.Token | undefined): boolean {
        return !!token &&
            (this._newlineType === null
                ? token.text.endsWith('\n')
                : token.type === this._newlineType);
    }

    private _isComment(token: moo.Token | undefined): boolean {
        return this._commentType !== null && !!token && token.type === this._commentType;
    }

    next(): IndentationToken | undefined {
        const nextToken = this._lexer.peek();

        if (this._state === 'lineStart') {
            if (this._isIndentation(nextToken)) {
                this._queuedTokens.push(this._getToken()!);
                return this.next();
            }
            if (this._isNewline(nextToken) || this._isComment(nextToken)) {
                this._state = 'lineEnding';
                return this.next();
            }
            this._state = 'lineContent';
            this._queuedLines.push(this._queuedTokens);
            this._queuedTokens = [];
            return this.next();
        }

        if (this._state === 'lineEnding') {
            const token = this._getToken()!;
            this._queuedTokens.push(token);

            if (this._isNewline(token)) {
                this._state = 'lineStart';
                this._queuedLines.push(this._queuedTokens);
                this._queuedTokens = [];
            }
            return this.next();
        }

        if (this._state === 'lineContent') {
            const indentationLevel = this._indentations[this._indentations.length - 1];
            const indentation = (this._queuedLines[this._queuedLines.length - 1] || []).map(({ text }) => text).join('');

            if (!nextToken && this._indentations.length > 1) {
                this._indentations.pop();
                return {
                    type: this._dedentName,
                    value: '',
                    text: '',
                    toString: this._lastToken!.toString,
                    offset: this._lastToken!.offset + this._lastToken!.text.length,
                    lineBreaks: 0,
                    line: this._lastToken!.line,
                    col: this._lastToken!.col + this._lastToken!.text.length,
                    indentation: this._indentations[this._indentations.length - 1]
                };
            }

            if (!nextToken || indentation === indentationLevel) {
                this._state = 'bufferFlush';
                return this.next();
            }

            if (indentation.startsWith(indentationLevel)) {
                if (this._separators.includes(this._queuedLines[0][0].text)) {
                    this._state = 'separatorFlush';
                    return this.next();
                }

                this._indentations.push(indentation);
                const startToken = this._queuedLines[0][0];
                return {
                    type: this._indentName,
                    value: '',
                    text: '',
                    toString: startToken.toString,
                    offset: startToken.offset,
                    lineBreaks: 0,
                    line: startToken.line,
                    col: startToken.col,
                    indentation: indentation
                };
            }

            this._indentations.pop();
            const startToken = this._queuedLines[0].length !== 0 ? this._queuedLines[0][0] : nextToken!;
            return {
                type: this._dedentName,
                value: '',
                text: '',
                toString: startToken.toString,
                offset: startToken.offset,
                lineBreaks: 0,
                line: startToken.line,
                col: startToken.col,
                indentation: this._indentations[this._indentations.length - 1]
            };
        }

        if (this._state === 'separatorFlush') {
            if (this._queuedLines[0].length === 0) {
                this._state = 'lineContent';
                this._queuedLines.shift();
                return this.next();
            }
            return this._queuedLines[0].shift();
        }

        if (this._state === 'bufferFlush') {
            if (this._queuedLines.length === 0) {
                this._state = 'lineFlush';
                return this.next();
            }
            if (this._queuedLines[0].length === 0) {
                this._queuedLines.shift();
                return this.next();
            }
            return this._queuedLines[0].shift();
        }

        if (this._state === 'lineFlush') {
            if (!nextToken && this._indentations.length > 1) {
                this._state = 'lineContent';
                return this.next();
            }

            if (nextToken && this._closingPunctuations.includes(nextToken.text)) {
                const indentation = this._indentations[this._indentations.length - 1];
                const match = this._matching[nextToken.text];

                const startPunctuation = this._enclosures.find(({ opening }) => opening === match);
                const { indentationLevel } = startPunctuation || { indentationLevel: '' };

                if (indentation !== indentationLevel && indentation.startsWith(indentationLevel)) {
                    this._indentations.pop();
                    return {
                        type: this._dedentName,
                        value: '',
                        text: '',
                        toString: nextToken.toString,
                        offset: nextToken.offset,
                        lineBreaks: 0,
                        line: nextToken.line,
                        col: nextToken.col,
                        indentation: indentationLevel
                    };
                }
            }

            const token = this._getToken();

            // Skip comments – they are not meaningful tokens for the parser
            if (this._isComment(token)) {
                return this.next();
            }

            if (this._isNewline(token)) {
                this._state = 'lineStart';
            }

            if (token && this._startingPunctuations.includes(token.text)) {
                this._enclosures.unshift({
                    opening: token.text,
                    indentationLevel: this._indentations[this._indentations.length - 1]
                });
            }

            if (token && this._separators.includes(token.text) && this._isNewline(this._lexer.peek())) {
                this._queuedTokens.push(token);
                this._queuedTokens.push(this._getToken()!);

                this._state = 'lineStart';
                this._queuedLines.push(this._queuedTokens);
                this._queuedTokens = [];

                return this.next();
            }

            return token;
        }

        return undefined;
    }

    [Symbol.iterator](): Iterator<moo.Token> {
        return new LexerIterator(this);
    }

    formatError(token?: moo.Token, message?: string): string {
        return this._lexer.formatError(token, message);
    }

    clone(): IndentationLexer {
        return new IndentationLexer({
            lexer: this._lexer.clone(),
            indentationType: this._indentationType,
            newlineType: this._newlineType,
            commentType: this._commentType,
            indentName: this._indentName,
            dedentName: this._dedentName,
            enclosingPunctuations: { ...this._enclosingPunctuations },
            separators: [...this._separators],
            state: this._state,
            enclosures: [...this._enclosures],
            indentations: [...this._indentations],
            queuedTokens: [...this._queuedTokens],
            queuedLines: [...this._queuedLines],
            lastToken: this._lastToken
        });
    }

    has(tokenType: string): boolean {
        return tokenType === this._indentName
            || tokenType === this._dedentName
            || this._lexer.has(tokenType);
    }
}

export default IndentationLexer;
