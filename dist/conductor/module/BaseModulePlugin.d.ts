import { IChannel, IConduit } from "../../conduit";
import { IInterfacableEvaluator } from "../runner/types";
import { IDataHandler } from "../types";
import { IModulePlugin, IModuleExport } from "./types";
export declare abstract class BaseModulePlugin implements IModulePlugin {
    readonly exports: IModuleExport[];
    readonly exportedNames: readonly (keyof this)[];
    readonly evaluator: IDataHandler;
    static readonly channelAttach: string[];
    constructor(_conduit: IConduit, _channels: IChannel<any>[], evaluator: IInterfacableEvaluator);
}
