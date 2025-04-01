import { ConductorInternalError } from "../../common/errors/ConductorInternalError";
import { IChannel, IConduit } from "../../conduit";
import { checkIsPluginClass } from "../../conduit/util";
import { IInterfacableEvaluator } from "../runner/types";
import { ExternCallable, IDataHandler, IFunctionSignature } from "../types";
import { IModulePlugin, IModuleExport } from "./types";

@checkIsPluginClass
export abstract class BaseModulePlugin implements IModulePlugin {
    readonly exports: IModuleExport[] = [];
    readonly exportedNames: readonly (keyof this)[] = [];

    readonly evaluator: IDataHandler;

    static readonly channelAttach: string[];
    constructor(_conduit: IConduit, _channels: IChannel<any>[], evaluator: IInterfacableEvaluator) {
        this.evaluator = evaluator;
        for (const name of this.exportedNames) {
            const m = this[name] as ExternCallable<IFunctionSignature> & {signature?: IFunctionSignature};
            if (!m.signature || typeof m !== "function" || typeof name !== "string") throw new ConductorInternalError(`'${String(name)}' is not an exportable method`);
            this.exports.push({
                symbol: name,
                value: m,
                signature: m.signature
            });
        }
    }
}
