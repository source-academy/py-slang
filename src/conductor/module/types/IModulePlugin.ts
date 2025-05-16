// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import type { IPlugin } from "../../../conduit";
import type { IDataHandler } from "../../types";
import type { IModuleExport } from "./IModuleExport";

export interface IModulePlugin extends IPlugin {
    readonly exports: IModuleExport[];

    readonly evaluator: IDataHandler;
}
