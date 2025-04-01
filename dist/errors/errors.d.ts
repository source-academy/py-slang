import * as es from 'estree';
import { RuntimeSourceError } from './runtimeSourceError';
export declare class TypeConcatenateError extends RuntimeSourceError {
    constructor(node: es.Node);
    explain(): string;
    elaborate(): string;
}
export declare class MissingRequiredPositionalError extends RuntimeSourceError {
    private functionName;
    private missingParamCnt;
    private missingParamName;
    constructor(node: es.Node, functionName: string, params: es.Pattern[], args: any);
    explain(): string;
    elaborate(): string;
    private joinWithCommasAndAnd;
}
export declare class TooManyPositionalArgumentsError extends RuntimeSourceError {
    private functionName;
    private expectedCount;
    private givenCount;
    constructor(node: es.Node, functionName: string, params: es.Pattern[], args: any);
    explain(): string;
    elaborate(): string;
}
