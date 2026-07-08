import { getFullLine, MAGIC_OFFSET } from "../errors";

export namespace TranslatorErrors {
    export class BaseTranslatorError extends SyntaxError {
        line: number;
        col: number;

        constructor(message: string, line: number, col: number) {
            super(`BaseTranslatorError at line ${line} column ${col-1}
                   ${message}`);
            this.line = line;
            this.col = col;
            this.name = "BaseTranslatorError";
        }
    }
    export class UnsupportedOperator extends BaseTranslatorError {
        constructor(line: number, col: number, source: string, start: number) {
            let { lineIndex, fullLine } = getFullLine(source, start);
            fullLine = '\n' + fullLine + '\n';
            let hint = `^ This operator is not yet supported by us.`;
            hint = hint.padStart(hint.length + col - MAGIC_OFFSET, " ");
            super(fullLine + hint, lineIndex, col);
            this.name = "UnsupportedOperator";
        }
    }
}