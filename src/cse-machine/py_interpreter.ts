import { Context } from "./context";
import { CSEBreak, Representation, Result, Finished } from "../types";
import { StmtNS } from "../ast-types";
import { Value, ErrorValue } from "./stash";

type Stmt = StmtNS.Stmt;

export function PyCSEResultPromise(context: Context, value: Value): Promise<Result> {
    return new Promise((resolve, reject) => {
        if (value instanceof CSEBreak) {
            resolve({ status: 'suspended-cse-eval', context });
        } else if (value.type === 'error') {
            const errorValue = value as ErrorValue;
            const representation = new Representation(errorValue.message);
            resolve({ status: 'finished', context, value, representation } as Finished);
        } else {
            const representation = new Representation(value);
            resolve({ status: 'finished', context, value, representation } as Finished);
        }
    });
}

export function PyEvaluate(code: string, program: Stmt, context: Context): Promise<Result> {
    // dummy for now, just to test getting AST from parser
    const dummyValue = { type: 'NoneType', value: undefined };
    return PyCSEResultPromise(context, dummyValue);
}