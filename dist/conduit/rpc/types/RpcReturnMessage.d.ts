import type { IRpcMessage } from "./IRpcMessage";
import { RpcMessageType } from "./RpcMessageType";
export declare class RpcReturnMessage implements IRpcMessage {
    type: RpcMessageType;
    readonly data: {
        invokeId: number;
        res: any;
    };
    constructor(invokeId: number, res: any);
}
