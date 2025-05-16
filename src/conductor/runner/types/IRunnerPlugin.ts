import type { ConductorError } from "../../../common/errors";
import type { IPlugin } from "../../../conduit";
import { PluginClass } from "../../../conduit/types";
import type { IModulePlugin } from "../../module";
import { ModuleClass } from "../../module/types/ModuleClass";
import type { Chunk, RunnerStatus } from "../../types";

export interface IRunnerPlugin extends IPlugin {
    /**
     * Request a file's contents.
     * @param fileName The name of the file to request.
     * @returns A promise resolving to the content of the requested file.
     */
    requestFile(fileName: string): Promise<string | undefined>;

    /**
     * Request the next chunk to run.
     * @returns A promise resolving to the next chunk.
     */
    requestChunk(): Promise<Chunk>;

    /**
     * Request for some input on standard-input.
     * @returns A promise resolving to the input received.
     */
    requestInput(): Promise<string>;

    /**
     * Try to request for some input on standard-input.
     * @returns The input received, or undefined if there is currently no input.
     */
    tryRequestInput(): string | undefined;

    /**
     * Sends a message on standard-output.
     * @param message The output message to send.
     */
    sendOutput(message: string): void;

    /**
     * Sends an error.
     * @param error The error to send.
     */
    sendError(error: ConductorError): void;

    /**
     * Provide a status update of the runner.
     * @param status The status to update.
     * @param isActive Is the specified status currently active?
     */
    updateStatus(status: RunnerStatus, isActive: boolean): void;

    /**
     * Informs the host to load a plugin.
     * @param pluginName The name of the plugin to load.
     */
    hostLoadPlugin(pluginName: string): void;

    /**
     * Registers a plugin with the conduit.
     * @param pluginClass The plugin class to be registered.
     * @param arg Arguments to be passed to pluginClass' constructor.
     * @returns The registered plugin.
     */
    registerPlugin<Arg extends any[], T extends IPlugin>(pluginClass: PluginClass<Arg, T>, ...arg: Arg): NoInfer<T>;

    /**
     * Unregister a plugin from the conduit.
     * @param plugin The plugin to be unregistered.
     */
    unregisterPlugin(plugin: IPlugin): void;

    /**
     * Registers an external module with the conduit, and links it with the evaluator.
     * @param moduleClass The module class to be registered.
     * @returns The registered module.
     */
    registerModule<T extends IModulePlugin>(moduleClass: ModuleClass<T>): T;

    /**
     * Unregisters an external module from the conduit, and unlinks it from the evaluator.
     * @param module The module to be unregistered.
     */
    unregisterModule(module: IModulePlugin): void;

    /**
     * Imports an external plugin and registers it with the conduit.
     * @param location The location of the external plugin.
     * @param arg Arguments to be passed to the external plugin's constructor.
     * @returns The imported plugin.
     */
    importAndRegisterExternalPlugin(location: string, ...arg: any[]): Promise<IPlugin>;

    /**
     * Imports an external module and registers it with the conduit.
     * @param location The location of the external module.
     * @returns The imported module.
     */
    importAndRegisterExternalModule(location: string): Promise<IModulePlugin>;
}
