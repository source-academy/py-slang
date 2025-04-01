import type { IRpcMessage } from "./IRpcMessage";
import { RpcMessageType } from "./RpcMessageType";
export declare class RpcErrorMessage implements IRpcMessage {
    type: RpcMessageType;
    readonly data: {
        invokeId: number;
        err: any;
    };
    constructor(invokeId: number, err: any);
}
