import { ConductorError } from "./ConductorError";
import { ErrorType } from "./ErrorType";
/**
 * Generic evaluation error, caused by a problem in user code.
 */
export declare class EvaluatorError extends ConductorError {
    name: string;
    readonly errorType: ErrorType | string;
    readonly rawMessage: string;
    readonly line?: number;
    readonly column?: number;
    readonly fileName?: string;
    constructor(message: string, line?: number, column?: number, fileName?: string);
}
