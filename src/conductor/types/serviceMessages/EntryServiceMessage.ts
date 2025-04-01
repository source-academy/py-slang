import type { IServiceMessage } from "../IServiceMessage";
import { ServiceMessageType } from "../ServiceMessageType";

export class EntryServiceMessage implements IServiceMessage {
    readonly type = ServiceMessageType.ENTRY;
    readonly data: string;
    constructor(entryPoint: string) {
        this.data = entryPoint;
    }
}
