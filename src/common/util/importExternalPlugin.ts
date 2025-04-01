import { PluginClass } from "../../conduit/types";

/**
 * Imports an external plugin from a given location.
 * @param location Where to find the external plugin.
 * @returns A promise resolving to the imported plugin.
 */
export async function importExternalPlugin(location: string): Promise<PluginClass> {
    const plugin = (await import(/* webpackIgnore: true */ location)).plugin as PluginClass;
    // TODO: verify it is actually a plugin
    return plugin;
}
