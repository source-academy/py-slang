import type { ServiceMessageType } from "./ServiceMessageType";

export interface IServiceMessage {
    readonly type: ServiceMessageType;
    readonly data?: any;
}
