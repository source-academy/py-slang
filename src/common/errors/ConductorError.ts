// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { ErrorType } from "./ErrorType";

/**
 * Generic Conductor Error.
 */
export class ConductorError extends Error {
    override name = "ConductorError";
    readonly errorType: ErrorType | string = ErrorType.UNKNOWN;
    
    constructor(message: string) {
        super(message);
    }
}
