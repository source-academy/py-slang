import { ErrorType } from "./ErrorType";
/**
 * Generic Conductor Error.
 */
export declare class ConductorError extends Error {
    name: string;
    readonly errorType: ErrorType | string;
    constructor(message: string);
}
