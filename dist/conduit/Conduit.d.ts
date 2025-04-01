import { IConduit, ILink, IPlugin, PluginClass } from "./types";
export declare class Conduit implements IConduit {
    private __alive;
    private readonly __link;
    private readonly __parent;
    private readonly __channels;
    private readonly __pluginMap;
    private readonly __plugins;
    private __negotiateChannel;
    private __verifyAlive;
    registerPlugin<Arg extends any[], T extends IPlugin>(pluginClass: PluginClass<Arg, T>, ...arg: Arg): NoInfer<T>;
    unregisterPlugin(plugin: IPlugin): void;
    lookupPlugin(pluginName: string): IPlugin;
    terminate(): void;
    private __handlePort;
    constructor(link: ILink, parent?: boolean);
}
