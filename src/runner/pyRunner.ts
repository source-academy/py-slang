import { IOptions } from ".."
import { Context } from "../cse-machine/context"
import { CSEResultPromise, evaluate } from "../cse-machine/interpreter"
import { RecursivePartial, Result } from "../types"
import * as es from 'estree'
import { PyEvaluate } from "../cse-machine/py_interpreter"
import { StmtNS } from "../ast-types";

export function runCSEMachine(code: string, program: es.Program, context: Context, options: RecursivePartial<IOptions> = {}): Promise<Result> {
    const result = evaluate(code, program, context, options);
    return CSEResultPromise(context, result);
}

type Stmt = StmtNS.Stmt;

export function PyRunCSEMachine(code: string, program: Stmt, context: Context, options: RecursivePartial<IOptions> = {}): Promise<Result> {
    return PyEvaluate(code, program, context);
}
