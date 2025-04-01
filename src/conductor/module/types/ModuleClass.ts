import { PluginClass } from "../../../conduit/types";
import { IEvaluator } from "../../runner/types";
import { IModulePlugin } from "./IModulePlugin";

export type ModuleClass<T extends IModulePlugin = IModulePlugin> = PluginClass<[IEvaluator], T>;
