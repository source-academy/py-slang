import { Context } from "./context";
import { CSEBreak, Representation, Result, Finished } from "../types";
import { StmtNS } from "../ast-types";
import { Value, ErrorValue } from "./stash";
import { PyVisitor } from "./py_visitor";
import { toPythonString } from "../stdlib";

type Stmt = StmtNS.Stmt;

export function PyCSEResultPromise(context: Context, value: Value): Promise<Result> {
    return new Promise((resolve, reject) => {
        if (value instanceof CSEBreak) {
            resolve({ status: 'suspended-cse-eval', context });
        } else if (value && value.type === 'error') {
            const errorValue = value as ErrorValue;
            const representation = new Representation(errorValue.message);
            resolve({ status: 'finished', context, value, representation } as Finished);
        } else {
            const representation = new Representation(toPythonString(value));
            resolve({ status: 'finished', context, value, representation } as Finished);
        }
    });
}

export function PyEvaluate(code: string, program: Stmt, context: Context): Promise<Result> {
    // dummy for now, just to test getting AST from parser
    const visitor = new PyVisitor(code, context);
    const result = visitor.visit(program);
    return PyCSEResultPromise(context, result);
}