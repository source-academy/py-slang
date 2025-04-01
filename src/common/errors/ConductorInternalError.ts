import { ConductorError } from "./ConductorError";
import { ErrorType } from "./ErrorType";

/**
 * Conductor internal error, probably caused by developer oversight.
 */
export class ConductorInternalError extends ConductorError {
    override name = "ConductorInternalError";
    override readonly errorType: ErrorType | string = ErrorType.INTERNAL;
    
    constructor(message: string) {
        super(message);
    }
}
