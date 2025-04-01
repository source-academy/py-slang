import type { IRpcMessage } from "./IRpcMessage";
import { RpcMessageType } from "./RpcMessageType";
export declare class RpcCallMessage implements IRpcMessage {
    type: RpcMessageType;
    readonly data: {
        fn: string | symbol;
        args: any[];
        invokeId: number;
    };
    constructor(fn: string | symbol, args: any[], invokeId: number);
}
