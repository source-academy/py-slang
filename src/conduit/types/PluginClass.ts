import { IChannel } from "./IChannel";
import { IConduit } from "./IConduit";
import type { IPlugin } from "./IPlugin";

export type PluginClass<Arg extends any[] = [], T = IPlugin> = {
    readonly channelAttach: string[];
} & (new (conduit: IConduit, channels: IChannel<any>[], ...arg: Arg) => T);
