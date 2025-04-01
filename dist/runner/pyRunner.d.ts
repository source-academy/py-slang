import { IOptions } from "..";
import { Context } from "../cse-machine/context";
import { RecursivePartial, Result } from "../types";
import * as es from 'estree';
export declare function runCSEMachine(program: es.Program, context: Context, options?: RecursivePartial<IOptions>): Promise<Result>;
