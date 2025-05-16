// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { ConductorError } from "../errors";

export class InvalidModuleError extends ConductorError {
    override name = "InvalidModuleError";
    override readonly errorType = "__invalidmodule";

    constructor() {
        super("Not a module");
    }
}
