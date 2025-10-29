import { getFullLine, MAGIC_OFFSET } from "../errors";

export namespace TokenizerErrors {
    export class BaseTokenizerError extends SyntaxError {
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
            let { lineIndex, fullLine } = getFullLine(source, current-1);
            fullLine = '\n' + fullLine + '\n';
            let hint = `${col > 1 ? '~' : ''}^~ Unknown token '${escape(token)}'`;
            // The extra `~` character takes up some space.
            hint = hint.padStart(hint.length + col - MAGIC_OFFSET - (col > 1 ? 1 : 0), " ");
            super(fullLine + hint, lineIndex, col);
            this.name = "UnknownTokenError";
        }
    }

    export class UnterminatedStringError extends BaseTokenizerError {
        constructor(line: number, col: number, source: string, start: number, current: number) {
            let { lineIndex, fullLine } = getFullLine(source, start);
            fullLine = '\n' + fullLine + '\n';
            let hint = `^ Unterminated string`;
            const diff = (current - start);
            // +1 because we want the arrow to point after the string (where we expect the closing ")
            hint = hint.padStart(hint.length + diff - MAGIC_OFFSET + 1, "~");
            hint = hint.padStart(hint.length + col - diff, " ");
            super(fullLine + hint, lineIndex, col);
            this.name = "UnterminatedStringError";
        }
    }

    export class NonFourIndentError extends BaseTokenizerError {
        constructor(line: number, col: number, source: string, start: number) {
            let { lineIndex, fullLine } = getFullLine(source, start);
            fullLine = '\n' + fullLine + '\n';
            let hint = `^ This indent should be a multiple of 4 spaces. It's currently ${col} spaces.`;
            hint = hint.padStart(hint.length + col - MAGIC_OFFSET, "-");
            super(fullLine + hint, lineIndex, col);
            this.name = "NonFourIndentError";
        }
    }
	
    export class InvalidNumberError extends BaseTokenizerError {
        constructor(line: number, col: number, source: string, start: number, current: number) {
            let { lineIndex, fullLine } = getFullLine(source, start);
            fullLine = '\n' + fullLine + '\n';
            let hint = `^ Invalid Number input.`;
            const diff = (current - start);
            // +1 because we want the arrow to point after the string (where we expect the closing ")
            hint = hint.padStart(hint.length + diff - MAGIC_OFFSET + 1, "~");
            hint = hint.padStart(hint.length + col - diff, " ");
            super(fullLine + hint, lineIndex, col);
            this.name = "InvalidNumberError";
        }
    }

    export class InconsistentIndentError extends BaseTokenizerError {
        constructor(line: number, col: number, source: string, start: number) {
            let { lineIndex, fullLine } = getFullLine(source, start);
            fullLine = '\n' + fullLine + '\n';
            let hint = `^ This indent/dedent is inconsistent with other indents/dedents. It's currently ${col} spaces.`;
            hint = hint.padStart(hint.length + col - MAGIC_OFFSET, "-");
            super(fullLine + hint, lineIndex, col);
            this.name = "InconsistentIndentError";
        }
    }
    export class ForbiddenIdentifierError extends BaseTokenizerError {
        constructor(line: number, col: number, source: string, start: number) {
            let { lineIndex, fullLine } = getFullLine(source, start);
            fullLine = '\n' + fullLine + '\n';
            let hint = `^ This identifier is reserved for use in Python. Consider using another identifier.`;
            hint = hint.padStart(hint.length + col - MAGIC_OFFSET, "^");
            super(fullLine + hint, lineIndex, col);
            this.name = "ForbiddenIdentifierError";
        }
    }
    export class ForbiddenOperatorError extends BaseTokenizerError {
        constructor(line: number, col: number, source: string, start: number, current: number) {
            let { lineIndex, fullLine } = getFullLine(source, start);
            fullLine = '\n' + fullLine + '\n';
            let hint = ` This operator is reserved for use in Python. It's not allowed to be used.`;
            const diff = (current - start);
            hint = hint.padStart(hint.length + diff - MAGIC_OFFSET + 1, "^");
            hint = hint.padStart(hint.length + col - diff, " ");
            super(fullLine + hint, lineIndex, col);
            this.name = "ForbiddenOperatorError";
        }
    }

    export class NonMatchingParenthesesError extends BaseTokenizerError {
        constructor(line: number, col: number, source: string, current: number) {
            let { lineIndex, fullLine } = getFullLine(source, current-1);
            fullLine = '\n' + fullLine + '\n';
            let hint = `${col > 1 ? '~' : ''}^~ Non-matching closing parentheses.`;
            // The extra `~` character takes up some space.
            hint = hint.padStart(hint.length + col - MAGIC_OFFSET - (col > 1 ? 1 : 0), " ");
            super(fullLine + hint, lineIndex, col);
            this.name = "NonMatchingParenthesesError";
        }
    }
}
