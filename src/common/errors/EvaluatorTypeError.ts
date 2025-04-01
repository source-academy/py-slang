import { ConductorError } from "./ConductorError";
import { ErrorType } from "./ErrorType";
import { EvaluatorError } from "./EvaluatorError";

/**
 * Evaluator type error - the user code is not well typed or provides values of incorrect type to external functions.
 */
export class EvaluatorTypeError extends EvaluatorError {
    override name = "EvaluatorTypeError";
    override readonly errorType: ErrorType | string = ErrorType.EVALUATOR_TYPE;

    override readonly rawMessage: string;
    readonly expected: string;
    readonly actual: string;

    constructor(message: string, expected: string, actual: string, line?: number, column?: number, fileName?: string) {
        super(`${message} (expected ${expected}, got ${actual})`, line, column, fileName);
        this.rawMessage = message;
        this.expected = expected;
        this.actual = actual;
    }
}
