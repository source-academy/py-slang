import type { IModulePlugin } from "../../conductor/module";
import { PluginClass } from "../../conduit/types";
import { importExternalPlugin } from "./importExternalPlugin";

/**
 * Imports an external module from a given location.
 * @param location Where to find the external module.
 * @returns A promise resolving to the imported module.
 */
export async function importExternalModule(location: string): Promise<PluginClass<any, IModulePlugin>> {
    const plugin = await importExternalPlugin(location) as PluginClass<any, IModulePlugin>;
    // TODO: additional verification it is a module
    return plugin;
}
