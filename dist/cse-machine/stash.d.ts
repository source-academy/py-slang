import { ExprNS, StmtNS } from '../ast-types';
import { Closure } from './closure';
import { Environment } from './environment';
import { Stack } from './stack';
/**
 * Value represents various runtime values in Python.
 */
export type Value = any;
export interface pyClosureValue {
    type: "closure";
    closure: Closure;
}
export interface BigIntValue {
    type: 'bigint';
    value: bigint;
}
export interface NumberValue {
    type: 'number';
    value: number;
}
export interface BoolValue {
    type: 'bool';
    value: boolean;
}
export interface StringValue {
    type: 'string';
    value: string;
}
export interface FunctionValue {
    type: 'function';
    name: string;
    params: string[];
    body: StmtNS.Stmt[];
    env: Environment;
}
export interface LambdaValue {
    type: 'lambda';
    parameters: string[];
    body: ExprNS.Expr;
    env: Environment;
}
export interface MultiLambdaValue {
    type: 'multi_lambda';
    parameters: string[];
    body: StmtNS.Stmt[];
    varDecls: string[];
    env: Environment;
}
export interface ErrorValue {
    type: 'error';
    message: string;
}
export interface UndefinedValue {
    type: 'undefined';
}
export declare class Stash extends Stack<Value> {
    constructor();
    copy(): Stash;
}
