// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

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
