import { ConductorError } from "../errors";
export declare class InvalidModuleError extends ConductorError {
    name: string;
    readonly errorType = "__invalidmodule";
    constructor();
}
