import { IChannel } from "../types";
import { IRpcMessage, Remote } from "./types";
export declare function makeRpc<ISelf, IOther>(channel: IChannel<IRpcMessage>, self: ISelf): Remote<IOther>;
