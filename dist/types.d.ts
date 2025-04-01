import * as es from 'estree';
import { Value } from './cse-machine/stash';
import { Context } from './cse-machine/context';
import { ModuleFunctions } from './modules/moduleTypes';
export declare class CSEBreak {
}
export declare enum ErrorType {
    IMPORT = "Import",
    RUNTIME = "Runtime",
    SYNTAX = "Syntax",
    TYPE = "Type"
}
export declare enum ErrorSeverity {
    WARNING = "Warning",
    ERROR = "Error"
}
export interface SourceError {
    type: ErrorType;
    severity: ErrorSeverity;
    location: es.SourceLocation;
    explain(): string;
    elaborate(): string;
}
export declare class PyComplexNumber {
    real: number;
    imag: number;
    constructor(real: number, imag: number);
    static fromNumber(value: number): PyComplexNumber;
    static fromBigInt(value: bigint): PyComplexNumber;
    static fromString(str: string): PyComplexNumber;
    static fromValue(value: number | bigint | string | PyComplexNumber): PyComplexNumber;
    /**
     * operations
     */
    add(other: PyComplexNumber): PyComplexNumber;
    sub(other: PyComplexNumber): PyComplexNumber;
    mul(other: PyComplexNumber): PyComplexNumber;
    div(other: PyComplexNumber): PyComplexNumber;
    pow(other: PyComplexNumber): PyComplexNumber;
    toString(): string;
    private toPythonComplexFloat;
    equals(other: PyComplexNumber): boolean;
}
export interface None extends es.BaseNode {
    type: 'NoneType';
    loc?: es.SourceLocation;
}
export interface ComplexLiteral extends es.BaseNode {
    type: 'Literal';
    complex: {
        real: number;
        imag: number;
    };
    loc?: es.SourceLocation;
}
/**
 * Helper type to recursively make properties that are also objects
 * partial
 *
 * By default, `Partial<Array<T>>` is equivalent to `Array<T | undefined>`. For this type, `Array<T>` will be
 * transformed to Array<Partial<T>> instead
 */
export type RecursivePartial<T> = T extends Array<any> ? Array<RecursivePartial<T[number]>> : T extends Record<any, any> ? Partial<{
    [K in keyof T]: RecursivePartial<T[K]>;
}> : T;
export type Result = Finished | Error | SuspendedCseEval;
export interface SuspendedCseEval {
    status: 'suspended-cse-eval';
    context: Context;
}
export interface Finished {
    status: 'finished';
    context: Context;
    value: Value;
    representation: Representation;
}
export declare class Representation {
    representation: string;
    constructor(representation: string);
    toString(value: any): string;
}
export interface NativeStorage {
    builtins: Map<string, Value>;
    previousProgramsIdentifiers: Set<string>;
    operators: Map<string, (...operands: Value[]) => Value>;
    maxExecTime: number;
    evaller: null | ((program: string) => Value);
    loadedModules: Record<string, ModuleFunctions>;
    loadedModuleTypes: Record<string, Record<string, string>>;
}
