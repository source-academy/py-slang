import type { DataType } from "./DataType";
import type { ExternTypeOf } from "./ExternTypeOf";
import type { IFunctionSignature } from "./IFunctionSignature";

type DataTypeMap<T extends readonly [...DataType[]]> = {
    [Idx in keyof T]: ExternTypeOf<T[Idx]>
};

/** The expected function type based on an IFunctionSignature. */
export type ExternCallable<T extends IFunctionSignature> = (...args: DataTypeMap<T["args"]>) => ExternTypeOf<T["returnType"]> | Promise<ExternTypeOf<T["returnType"]>>;
