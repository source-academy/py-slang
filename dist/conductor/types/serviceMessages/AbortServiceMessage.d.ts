import type { IServiceMessage } from "../IServiceMessage";
import { ServiceMessageType } from "../ServiceMessageType";
export declare class AbortServiceMessage implements IServiceMessage {
    readonly type = ServiceMessageType.ABORT;
    readonly data: {
        minVersion: number;
    };
    constructor(minVersion: number);
}
