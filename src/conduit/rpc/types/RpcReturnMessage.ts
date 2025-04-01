import type { IRpcMessage } from "./IRpcMessage";
import { RpcMessageType } from "./RpcMessageType";

export class RpcReturnMessage implements IRpcMessage {
    type = RpcMessageType.RETURN;
    readonly data: {invokeId: number, res: any};

    constructor(invokeId: number, res: any) {
        this.data = {invokeId, res};
    }
}
