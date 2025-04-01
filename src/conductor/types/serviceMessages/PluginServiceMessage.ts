import type { IServiceMessage } from "../IServiceMessage";
import { ServiceMessageType } from "../ServiceMessageType";

export class PluginServiceMessage implements IServiceMessage {
    readonly type = ServiceMessageType.PLUGIN;
    readonly data: string;
    constructor(pluginName: string) {
        this.data = pluginName;
    }
}
