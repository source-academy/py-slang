import { ConductorError } from "../errors";

export class InvalidModuleError extends ConductorError {
    override name = "InvalidModuleError";
    override readonly errorType = "__invalidmodule";

    constructor() {
        super("Not a module");
    }
}
