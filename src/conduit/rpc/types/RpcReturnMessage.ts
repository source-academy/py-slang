// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import type { IRpcMessage } from "./IRpcMessage";
import { RpcMessageType } from "./RpcMessageType";

export class RpcReturnMessage implements IRpcMessage {
    type = RpcMessageType.RETURN;
    readonly data: {invokeId: number, res: any};

    constructor(invokeId: number, res: any) {
        this.data = {invokeId, res};
    }
}
