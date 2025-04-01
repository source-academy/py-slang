import { PluginClass } from "../../conduit/types";
/**
 * Imports an external plugin from a given location.
 * @param location Where to find the external plugin.
 * @returns A promise resolving to the imported plugin.
 */
export declare function importExternalPlugin(location: string): Promise<PluginClass>;
