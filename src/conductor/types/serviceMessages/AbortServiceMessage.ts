import type { IServiceMessage } from "../IServiceMessage";
import { ServiceMessageType } from "../ServiceMessageType";

export class AbortServiceMessage implements IServiceMessage {
    readonly type = ServiceMessageType.ABORT;
    readonly data: {minVersion: number};
    constructor(minVersion: number) {
        this.data = {minVersion: minVersion};
    }
}
