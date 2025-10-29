import { getFullLine, MAGIC_OFFSET } from "../errors";
import { Token } from "../tokenizer";

export namespace ResolverErrors {
    export class BaseResolverError extends SyntaxError {
        line: number;
        col: number;

        constructor(name: string, message: string, line: number, col: number) {
            super(`${name} at line ${line}
                   ${message}`);
            this.line = line;
            this.col = col;
            this.name = "BaseResolverError";
        }
    }
    export class NameNotFoundError extends BaseResolverError {
        constructor(line: number, col: number, source: string, start: number,
                    current: number, suggestion: string | null) {
            let { lineIndex, fullLine } = getFullLine(source, start);
            fullLine = '\n' + fullLine + '\n';
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
            const name = "NameNotFoundError";
            super(name, fullLine + hint, lineIndex, col);
            this.name = "NameNotFoundError";
        }
    }

    export class NameReassignmentError extends BaseResolverError {
        constructor(line: number, col: number, source: string, start: number,
                    current: number, oldName: Token) {
            let { lineIndex, fullLine } = getFullLine(source, start);
            fullLine = '\n' + fullLine + '\n';
            let hint = ` A name has been declared here.`;
            const diff = (current - start);
            hint = hint.padStart(hint.length + diff - MAGIC_OFFSET + 1, "^");
            hint = hint.padStart(hint.length + col - diff, " ");
            let { lineIndex: oldLine, fullLine: oldNameLine } = getFullLine(source, oldName.indexInSource);
            oldNameLine = '\n' + oldNameLine + '\n';
            let sugg = ` However, it has already been declared in the same environment at line ${oldLine}, here: `
            sugg = sugg.padStart(sugg.length + col - MAGIC_OFFSET + 1, " ");
            sugg = '\n' + sugg;
            hint += sugg;
            oldNameLine.padStart(oldNameLine.length + col - MAGIC_OFFSET + 1, " ");
            hint += oldNameLine;
            const name = "NameReassignmentError";
            super(name, fullLine + hint, lineIndex, col);
            this.name = "NameReassignmentError";
        }
    }
}
