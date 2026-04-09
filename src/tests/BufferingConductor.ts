import type { ConductorError } from "@sourceacademy/conductor/common";
import type { IPlugin, PluginClass } from "@sourceacademy/conductor/conduit";
import type { IModulePlugin, ModuleClass } from "@sourceacademy/conductor/module";
import type { RunnerStatus } from "@sourceacademy/conductor/types";
import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";

/**
 * Minimal IRunnerPlugin implementation for use in tests.
 * Buffers outputs and results so tests can assert on them.
 */
export class BufferingConductor implements IRunnerPlugin {
  readonly id = "buffering-conductor";
  private _result: unknown = undefined;
  private _error: ConductorError | undefined = undefined;
  private _outputs: string[] = [];

  sendOutput(message: string): void {
    this._outputs.push(message);
  }

  sendResult(result: unknown): void {
    this._result = result;
  }

  sendError(error: ConductorError): void {
    this._error = error;
  }

  requestFile(_fileName: string): Promise<string | undefined> {
    return Promise.resolve(undefined);
  }

  requestChunk(): Promise<string> {
    return Promise.resolve("");
  }

  requestInput(): Promise<string> {
    return Promise.resolve("");
  }

  tryRequestInput(): string | undefined {
    return undefined;
  }

  updateStatus(_status: RunnerStatus, _isActive: boolean): void {}

  hostLoadPlugin(_pluginId: string): void {}

  hostQueryPluginResolutions(_pluginId: string): Promise<Record<string, string>> {
    return Promise.resolve({});
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerPlugin<Arg extends any[], T extends IPlugin>(
    _pluginClass: PluginClass<Arg, T>,
    ..._arg: Arg
  ): T {
    throw new Error("Not implemented");
  }

  unregisterPlugin(_plugin: IPlugin): void {}

  registerModule<T extends IModulePlugin>(_moduleClass: ModuleClass<T>): T {
    throw new Error("Not implemented");
  }

  unregisterModule(_module: IModulePlugin): void {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  importAndRegisterExternalPlugin(_location: string, ..._arg: any[]): Promise<IPlugin> {
    throw new Error("Not implemented");
  }

  importAndRegisterExternalModule(_location: string): Promise<IModulePlugin> {
    throw new Error("Not implemented");
  }

  getResult(): unknown {
    return this._result;
  }

  getError(): ConductorError | undefined {
    return this._error;
  }

  getOutputs(): string[] {
    return this._outputs;
  }
}
