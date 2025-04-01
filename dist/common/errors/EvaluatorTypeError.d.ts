import { ErrorType } from "./ErrorType";
import { EvaluatorError } from "./EvaluatorError";
/**
 * Evaluator type error - the user code is not well typed or provides values of incorrect type to external functions.
 */
export declare class EvaluatorTypeError extends EvaluatorError {
    name: string;
    readonly errorType: ErrorType | string;
    readonly rawMessage: string;
    readonly expected: string;
    readonly actual: string;
    constructor(message: string, expected: string, actual: string, line?: number, column?: number, fileName?: string);
}
