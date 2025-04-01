import { Program } from "estree";
import { Context } from './cse-machine/context';
export * from './errors';
import { RecursivePartial, Result } from "./types";
export declare function parsePythonToEstreeAst(code: string, variant?: number, doValidate?: boolean): Program;
export interface IOptions {
    isPrelude: boolean;
    envSteps: number;
    stepLimit: number;
}
export declare function runInContext(code: string, context: Context, options?: RecursivePartial<IOptions>): Promise<Result>;
