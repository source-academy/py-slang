import type { IRpcMessage } from "./IRpcMessage";
import { RpcMessageType } from "./RpcMessageType";

export class RpcCallMessage implements IRpcMessage {
    type = RpcMessageType.CALL;
    readonly data: {fn: string | symbol, args: any[], invokeId: number};

    constructor(fn: string | symbol, args: any[], invokeId: number) {
        this.data = {fn, args, invokeId};
    }
}
