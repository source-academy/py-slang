import { IChannel } from "./IChannel";
import { IConduit } from "./IConduit";
import { IPlugin } from "./IPlugin";

export type AbstractPluginClass<Arg extends any[] = [], T = IPlugin> = {
    readonly channelAttach: string[];
} & (abstract new (conduit: IConduit, channels: IChannel<any>[], ...arg: Arg) => T);
