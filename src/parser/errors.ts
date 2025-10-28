import { createErrorIndicator, getFullLine, MAGIC_OFFSET } from "../errors";
import { Token } from "../tokenizer";

export namespace ParserErrors {
    export class BaseParserError extends SyntaxError {
        line: number;
        col: number;

        constructor(message: string, line: number, col: number) {
            super(`SyntaxError at line ${line}
                   ${message}`);
            this.line = line;
            this.col = col;
            this.name = "BaseParserError";
        }
    }
    export class ExpectedTokenError extends BaseParserError {
        constructor(source: string, current: Token, expected: string) {
            let { lineIndex, fullLine } = getFullLine(source, current.indexInSource - current.lexeme.length);
            fullLine = '\n' + fullLine + '\n';
            let hint = `^ ${expected}. Found '${current.lexeme}'.`;
            hint = hint.padStart(hint.length + current.col - MAGIC_OFFSET, " ");
            super(fullLine + hint, lineIndex, current.col);
            this.name = "ExpectedTokenError";
        }
    }
    export class NoElseBlockError extends BaseParserError {
        constructor(source: string, current: Token) {
            let { lineIndex, fullLine } = getFullLine(source, current.indexInSource);
            fullLine = '\n' + fullLine + '\n';
            let hint = `^ Expected else block after this if block.`;
            hint = hint.padStart(hint.length + current.col - MAGIC_OFFSET, " ");
            super(fullLine + hint, lineIndex, current.col);
            this.name = "NoElseBlockError";
        }
    }
    export class GenericUnexpectedSyntaxError extends BaseParserError {
        constructor(line: number, col: number, source: string, start: number, current: number) {
            let { lineIndex, fullLine } = getFullLine(source, start);
            fullLine = '\n' + fullLine + '\n';
            let hint = ` Detected invalid syntax.`;
            const indicator = createErrorIndicator(fullLine, '@');
            super(fullLine + indicator + hint, lineIndex, col);
            this.name = "GenericUnexpectedSyntaxError";
        }
    }
}
