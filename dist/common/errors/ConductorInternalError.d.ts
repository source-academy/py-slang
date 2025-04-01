import { ConductorError } from "./ConductorError";
import { ErrorType } from "./ErrorType";
/**
 * Conductor internal error, probably caused by developer oversight.
 */
export declare class ConductorInternalError extends ConductorError {
    name: string;
    readonly errorType: ErrorType | string;
    constructor(message: string);
}
