import {Token} from "./tokenizer";

/*The offset is calculated as follows:
  Current position is one after real position of end of token: 1
*/
const MAGIC_OFFSET = 1;

function escape(unsafe: string): string {
    // @TODO escape newlines
    return unsafe.replace(/[\\$'"]/g, "\\$&");
}


/* Searches backwards and forwards till it hits a newline */
function getFullLine(source: string, current: number): string {
    let back: number = current;
    let forward: number = current;

    while (back > 0 && source[back] != '\n') {
        back--;
    }
    if (source[back] === '\n') {
        back++;
    }
    while (forward < source.length && source[forward] != '\n') {
        forward++;
    }
    return '\n' + source.slice(back, forward);
}

export namespace TokenizerErrors {
    export class BaseTokenizerError extends Error {
        line: number;
        col: number;

        constructor(message: string, line: number, col: number) {
            super(`SyntaxError at line ${line} column ${col-1}
                   ${message}`);
            this.line = line;
            this.col = col;
            this.name = "BaseTokenizerError";
        }
    }

    export class UnknownTokenError extends BaseTokenizerError {
        constructor(token: string, line: number, col: number, source: string, current: number) {
            let msg = getFullLine(source, current-1) + "\n";
            let hint = `${col > 1 ? '~' : ''}^~ Unknown token '${escape(token)}'`;
            // The extra `~` character takes up some space.
            hint = hint.padStart(hint.length + col - MAGIC_OFFSET - (col > 1 ? 1 : 0), " ");
            super(msg + hint, line, col);
            this.name = "UnknownTokenError";
        }
    }

    export class UnterminatedStringError extends BaseTokenizerError {
        constructor(line: number, col: number, source: string, start: number, current: number) {
            let msg = getFullLine(source, start) + "\n";
            let hint = `^ Unterminated string`;
            const diff = (current - start);
            // +1 because we want the arrow to point after the string (where we expect the closing ")
            hint = hint.padStart(hint.length + diff - MAGIC_OFFSET + 1, "~");
            hint = hint.padStart(hint.length + col - diff, " ");
            super(msg + hint, line, col);
            this.name = "UnterminatedStringError";
        }
    }

    export class NonFourIndentError extends BaseTokenizerError {
        constructor(line: number, col: number, source: string, start: number) {
            let msg = getFullLine(source, start) + "\n";
            let hint = `^ This indent should be a multiple of 4 spaces. It's currently ${col} spaces.`;
            hint = hint.padStart(hint.length + col - MAGIC_OFFSET, "-");
            super(msg + hint, line, col);
            this.name = "NonFourIndentError";
        }
    }
    export class ForbiddenIdentifierError extends BaseTokenizerError {
        constructor(line: number, col: number, source: string, start: number) {
            let msg = getFullLine(source, start) + "\n";
            let hint = `^ This identifier is reserved for use in Python. Consider using another identifier.`;
            hint = hint.padStart(hint.length + col - MAGIC_OFFSET, "^");
            super(msg + hint, line, col);
            this.name = "ForbiddenIdentifierError";
        }
    }
    export class ForbiddenOperatorError extends BaseTokenizerError {
        constructor(line: number, col: number, source: string, start: number, current: number) {
            let msg = getFullLine(source, start) + "\n";
            let hint = ` This operator is reserved for use in Python. It's not allowed to be used.`;
            const diff = (current - start);
            hint = hint.padStart(hint.length + diff - MAGIC_OFFSET + 1, "^");
            hint = hint.padStart(hint.length + col - diff, " ");
            super(msg + hint, line, col);
            this.name = "ForbiddenOperatorError";
        }
    }
}

export namespace ParserErrors {
    export class BaseParserError extends Error {
        line: number;
        col: number;

        constructor(message: string, line: number, col: number) {
            super(`SyntaxError at line ${line} column ${col-1}
                   ${message}`);
            this.line = line;
            this.col = col;
            this.name = "BaseParserError";
        }
    }
    export class ExpectedTokenError extends BaseParserError {
        constructor(source: string, current: Token, expected: string) {
            let msg = getFullLine(source, current.indexInSource - current.lexeme.length) + "\n";
            let hint = `^ ${expected}. Found '${escape(current.lexeme)}'.`;
            hint = hint.padStart(hint.length + current.col - MAGIC_OFFSET, " ");
            super(msg + hint, current.line, current.col);
            this.name = "ExpectedTokenError";
        }
    }
    export class NoElseBlockError extends BaseParserError {
        constructor(source: string, current: Token) {
            let msg = getFullLine(source, current.indexInSource) + "\n";
            let hint = `^ Expected else block after this if block.`;
            hint = hint.padStart(hint.length + current.col - MAGIC_OFFSET, " ");
            super(msg + hint, current.line, current.col);
            this.name = "ExpectedTokenError";
        }
    }
    export class GenericUnexpectedSyntaxError extends BaseParserError {
        constructor(line: number, col: number, source: string, start: number, current: number) {
            let msg = getFullLine(source, start) + "\n";
            let hint = ` Detected invalid syntax.`;
            const diff = (current - start);
            hint = hint.padStart(hint.length + diff - MAGIC_OFFSET, "^");
            hint = hint.padStart(hint.length + col - diff, " ");
            super(msg + hint, line, col);
            this.name = "GenericUnexpectedSyntaxError";
        }
    }
}

export namespace ResolverErrors {
    export class BaseResolverError extends Error {
        line: number;
        col: number;

        constructor(message: string, line: number, col: number) {
            super(`ResolverError at line ${line} column ${col-1}
                   ${message}`);
            this.line = line;
            this.col = col;
            this.name = "BaseResolverError";
        }
    }
    export class NameNotFoundError extends BaseResolverError {
        constructor(line: number, col: number, source: string, start: number,
                    current: number, suggestion: string | null) {
            let msg = getFullLine(source, start) + "\n";
            let hint = ` This name is not found in the current or enclosing environment(s).`;
            const diff = (current - start);
            hint = hint.padStart(hint.length + diff - MAGIC_OFFSET + 1, "^");
            hint = hint.padStart(hint.length + col - diff, " ");
            if (suggestion !== null) {
                let sugg = ` Perhaps you meant to type '${suggestion}'?`
                sugg = sugg.padStart(sugg.length + col - MAGIC_OFFSET + 1, " ");
                sugg = '\n' + sugg;
                hint += sugg;
            }
            super(msg + hint, line, col);
            this.name = "NameNotFoundError";
        }
    }

    export class NameReassignmentError extends BaseResolverError {
        constructor(line: number, col: number, source: string, start: number,
                    current: number, oldName: Token) {
            let msg = getFullLine(source, start) + "\n";
            let hint = ` A name has been declared here.`;
            const diff = (current - start);
            hint = hint.padStart(hint.length + diff - MAGIC_OFFSET + 1, "^");
            hint = hint.padStart(hint.length + col - diff, " ");
            let sugg = ` However, it has already been declared in the same environment at line ${oldName.line}, here:`
            sugg = sugg.padStart(sugg.length + col - MAGIC_OFFSET + 1, " ");
            sugg = '\n' + sugg;
            hint += sugg;
            let oldNameLine = getFullLine(source, oldName.indexInSource);
            oldNameLine.padStart(oldNameLine.length + col - MAGIC_OFFSET + 1, " ");
            oldNameLine = oldNameLine;
            hint += oldNameLine;
            super(msg + hint, line, col);
            this.name = "NameReassignmentError";
        }
    }
}