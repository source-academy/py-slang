import type { ConductorError } from "../../../common/errors";
import type { IPlugin } from "../../../conduit";
import { PluginClass } from "../../../conduit/types";
import type { Chunk, RunnerStatus } from "../../types";

export interface IHostPlugin extends IPlugin {
    /**
     * Request a file's contents.
     * @param fileName The name of the file to request.
     * @returns A promise resolving to the content of the requested file.
     */
    requestFile(fileName: string): Promise<string | undefined>;

    /**
     * Request to load a plugin.
     * @param pluginName The name of the plugin to request loading.
     */
    requestLoadPlugin(pluginName: string): void;

    /**
     * Starts the evaluator.
     * @param entryPoint The entry point file to start running from.
     */
    startEvaluator(entryPoint: string): void;

    /**
     * Send the next chunk to be run.
     * @param chunk The next chunk to be run.
     */
    sendChunk(chunk: Chunk): void;

    /**
     * Send an input on standard-input.
     * @param input The input to be sent on standard-input.
     */
    sendInput(input: string): void;

    // /**
    //  * Request for some output on standard-output.
    //  * @returns A promise resolving to the output received.
    //  */
    // requestOutput(): Promise<string>;

    // /**
    //  * Try to request for some output on standard-output.
    //  * @returns The output received, or undefined if there is currently no output.
    //  */
    // tryRequestOutput(): string | undefined;

    /**
     * An event handler called when an output is received.
     * @param message The output received.
     */
    receiveOutput?(message: string): void;

    // /**
    //  * Request for some output on standard-error.
    //  * @returns A promise resolving to the error received.
    //  */
    // requestError(): Promise<ConductorError>;

    // /**
    //  * Try to request for some output on standard-error.
    //  * @returns The error received, or undefined if there is currently no error.
    //  */
    // tryRequestError(): ConductorError | undefined;

    /**
     * An event handler called when an error is received.
     * @param message The error received.
     */
    receiveError?(message: ConductorError): void;

    /**
     * Checks if a runner status is active.
     * @param status The runner status to check.
     * @returns true if the given status is active.
     */
    isStatusActive(status: RunnerStatus): boolean;

    /**
     * An event handler called when a status update is received.
     * @param message The status update received.
     * @param isActive Is the specified status currently active?
     */
    receiveStatusUpdate?(status: RunnerStatus, isActive: boolean): void;

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
     * Imports an external plugin and registers it with the conduit.
     * @param location The location of the external plugin.
     * @param arg Arguments to be passed to the external plugin's constructor.
     * @returns The imported plugin.
     */
    importAndRegisterExternalPlugin(location: string, ...arg: any[]): Promise<IPlugin>;
}
