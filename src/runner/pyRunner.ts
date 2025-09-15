import { IOptions } from ".."
import { CSEResultPromise, evaluate } from "../cse-machine/interpreter"
import { RecursivePartial, Result } from "../types"
import * as es from 'estree'
import { PyEvaluate, PyCSEResultPromise } from "../cse-machine/py_interpreter"
import { Context } from "../cse-machine/context"
import { StmtNS } from "../ast-types";
import { PyContext } from "../cse-machine/py_context"

export function runCSEMachine(code: string, program: es.Program, context: Context, options: RecursivePartial<IOptions> = {}): Promise<Result> {
    const result = evaluate(code, program, context, options);
    return CSEResultPromise(context, result);
}

type Stmt = StmtNS.Stmt;

export function PyRunCSEMachine(code: string, program: Stmt, context: PyContext, options: RecursivePartial<IOptions> = {}): Promise< Result> {
    const value = PyEvaluate(code, program, context, options as IOptions); 
    return PyCSEResultPromise(context, value);
}
