// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import type { IRpcMessage } from "./IRpcMessage";
import { RpcMessageType } from "./RpcMessageType";

export class RpcErrorMessage implements IRpcMessage {
    type = RpcMessageType.RETURN_ERR;
    readonly data: {invokeId: number, err: any};

    constructor(invokeId: number, err: any) {
        this.data = {invokeId, err};
    }
}
