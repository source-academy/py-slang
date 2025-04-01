import type { ExternCallable, IFunctionSignature, NativeValue } from "../../types";

export interface IModuleExport {
    /** The symbol referencing the export. */
    symbol: string;

    /** The exported value. Can be JS-native values or a function. */
    value: NativeValue | ExternCallable<any>;

    /** If value is a function, provides its function signature. */
    signature?: IFunctionSignature; // TODO: allow richer typing somehow?
}
