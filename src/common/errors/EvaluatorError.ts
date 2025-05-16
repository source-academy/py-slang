import { ConductorError } from "./ConductorError";
import { ErrorType } from "./ErrorType";

/**
 * Generic evaluation error, caused by a problem in user code.
 */
export class EvaluatorError extends ConductorError {
    override name = "EvaluatorError";
    override readonly errorType: ErrorType | string = ErrorType.EVALUATOR;

    readonly rawMessage: string;
    readonly line?: number;
    readonly column?: number;
    readonly fileName?: string

    constructor(message: string, line?: number, column?: number, fileName?: string) {
        const location = line !== undefined
            ? `${fileName ? fileName + ":" : ""}${line}${column !== undefined ? ":" + column : ""}: `
            : "";
        super(`${location}${message}`);
        this.rawMessage = message;
        this.line = line;
        this.column = column;
        this.fileName = fileName
    }
}
