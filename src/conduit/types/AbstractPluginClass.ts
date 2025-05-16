// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { IChannel } from "./IChannel";
import { IConduit } from "./IConduit";
import { IPlugin } from "./IPlugin";

export type AbstractPluginClass<Arg extends any[] = [], T = IPlugin> = {
    readonly channelAttach: string[];
} & (abstract new (conduit: IConduit, channels: IChannel<any>[], ...arg: Arg) => T);
