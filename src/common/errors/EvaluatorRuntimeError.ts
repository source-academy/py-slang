import { ErrorType } from "./ErrorType";
import { EvaluatorError } from "./EvaluatorError";

/**
 * Evaluator runtime error - some problem occurred while running the user code.
 */
export class EvaluatorRuntimeError extends EvaluatorError {
    override name = "EvaluatorRuntimeError";
    override readonly errorType: ErrorType | string = ErrorType.EVALUATOR_RUNTIME;
}
