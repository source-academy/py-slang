import { RpcMessageType } from "./RpcMessageType";

export interface IRpcMessage {
    type: RpcMessageType;
    data?: any;
}
