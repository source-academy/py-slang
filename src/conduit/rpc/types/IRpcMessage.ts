// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { RpcMessageType } from "./RpcMessageType";

export interface IRpcMessage {
    type: RpcMessageType;
    data?: any;
}
