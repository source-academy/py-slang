import { IOptions } from ".."
import { Context } from "../cse-machine/context"
import { CSEResultPromise, evaluate } from "../cse-machine/interpreter"
import { RecursivePartial, Result } from "../types"
import * as es from 'estree'

export function runCSEMachine(program: es.Program, context: Context, options: RecursivePartial<IOptions> = {}): Promise<Result> {
    const result = evaluate(program, context, options);
    return CSEResultPromise(context, result);
}