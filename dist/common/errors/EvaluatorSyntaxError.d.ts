import { ErrorType } from "./ErrorType";
import { EvaluatorError } from "./EvaluatorError";
/**
 * Evaluator syntax error - the user code does not follow the evaluator's prescribed syntax.
 */
export declare class EvaluatorSyntaxError extends EvaluatorError {
    name: string;
    readonly errorType: ErrorType | string;
}
