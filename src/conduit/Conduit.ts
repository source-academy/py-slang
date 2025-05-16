import { ConductorInternalError } from "../common/errors/ConductorInternalError";
import { Channel } from "./Channel";
import { IConduit, ILink, IPlugin, IChannel, PluginClass } from "./types";

export class Conduit implements IConduit {
    private __alive: boolean = true;
    private readonly __link: ILink;
    private readonly __parent: boolean;
    private readonly __channels: Map<string, Channel<any>> = new Map();
    private readonly __pluginMap: Map<string, IPlugin> = new Map();
    private readonly __plugins: IPlugin[] = [];
    private __negotiateChannel(channelName: string): void {
        const { port1, port2 } = new MessageChannel();
        const channel = new Channel(channelName, port1);
        this.__link.postMessage([channelName, port2], [port2]); // TODO: update communication protocol?
        this.__channels.set(channelName, channel);
    }
    private __verifyAlive() {
        if (!this.__alive) throw new ConductorInternalError("Conduit already terminated");
    }
    registerPlugin<Arg extends any[], T extends IPlugin>(pluginClass: PluginClass<Arg, T>, ...arg: Arg): NoInfer<T> {
        this.__verifyAlive();
        const attachedChannels: IChannel<any>[] = [];
        for (const channelName of pluginClass.channelAttach) {
            if (!this.__channels.has(channelName)) this.__negotiateChannel(channelName);
            attachedChannels.push(this.__channels.get(channelName)!); // as the Channel has been negotiated
        }
        const plugin = new pluginClass(this, attachedChannels, ...arg);

        if (plugin.name !== undefined) {
            if (this.__pluginMap.has(plugin.name)) throw new ConductorInternalError(`Plugin ${plugin.name} already registered`);
            this.__pluginMap.set(plugin.name, plugin);
        }

        this.__plugins.push(plugin);

        return plugin;
    }
    unregisterPlugin(plugin: IPlugin): void {
        this.__verifyAlive();
        let p = 0;
        for (let i = 0; i < this.__plugins.length; ++i) {
            if (this.__plugins[p] === plugin) ++p;
            this.__plugins[i] = this.__plugins[i + p];
        }
        for (let i = this.__plugins.length - 1, e = this.__plugins.length - p; i >= e; --i) {
            delete this.__plugins[i];
        }
        if (plugin.name) {
            this.__pluginMap.delete(plugin.name);
        }
        plugin.destroy?.();
    }
    lookupPlugin(pluginName: string): IPlugin {
        this.__verifyAlive();
        if (!this.__pluginMap.has(pluginName)) throw new ConductorInternalError(`Plugin ${pluginName} not registered`);
        return this.__pluginMap.get(pluginName)!; // as the map has been checked
    }
    terminate(): void {
        this.__verifyAlive();
        for (const plugin of this.__plugins) {
            //this.unregisterPlugin(plugin);
            plugin.destroy?.();
        }
        this.__link.terminate?.();
        this.__alive = false;
    }
    private __handlePort(data: [string, MessagePort]) { // TODO: update communication protocol?
        const [channelName, port] = data;
        if (this.__channels.has(channelName)) { // uh-oh, we already have a port for this channel
            const channel = this.__channels.get(channelName)!; // as the map has been checked
            if (this.__parent) { // extract the data and discard the messageport; child's Channel will close it
                channel.listenToPort(port);
            } else { // replace our messageport; Channel will close it
                channel.replacePort(port);
            }
        } else { // register the new channel
            const channel = new Channel(channelName, port);
            this.__channels.set(channelName, channel);
        }
    }
    constructor(link: ILink, parent: boolean = false) {
        this.__link = link;
        link.addEventListener("message", e => this.__handlePort(e.data));
        this.__parent = parent;
    }
}
