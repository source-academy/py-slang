import { ErrorType } from "./ErrorType";
import { EvaluatorError } from "./EvaluatorError";
/**
 * Evaluator runtime error - some problem occurred while running the user code.
 */
export declare class EvaluatorRuntimeError extends EvaluatorError {
    name: string;
    readonly errorType: ErrorType | string;
}
