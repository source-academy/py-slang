// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { PluginClass } from "../../../conduit/types";
import { IEvaluator } from "../../runner/types";
import { IModulePlugin } from "./IModulePlugin";

export type ModuleClass<T extends IModulePlugin = IModulePlugin> = PluginClass<[IEvaluator], T>;
