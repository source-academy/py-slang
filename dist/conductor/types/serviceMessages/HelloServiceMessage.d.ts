import { Constant } from "../../../common/Constant";
import type { IServiceMessage } from "../IServiceMessage";
import { ServiceMessageType } from "../ServiceMessageType";
export declare class HelloServiceMessage implements IServiceMessage {
    readonly type = ServiceMessageType.HELLO;
    readonly data: {
        version: Constant;
    };
}
