import type { IModulePlugin } from "../../conductor/module";
import { PluginClass } from "../../conduit/types";
/**
 * Imports an external module from a given location.
 * @param location Where to find the external module.
 * @returns A promise resolving to the imported module.
 */
export declare function importExternalModule(location: string): Promise<PluginClass<any, IModulePlugin>>;
