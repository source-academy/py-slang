import * as es from 'estree';
import { Environment } from './environment';
import { Context } from './context';
import { StatementSequence } from './types';
import { ControlItem } from './control';
export declare class Closure {
    node: es.ArrowFunctionExpression;
    environment: Environment;
    context: Context;
    predefined: boolean;
    originalNode?: es.ArrowFunctionExpression;
    /** Unique ID defined for closure */
    /** Name of the constant declaration that the closure is assigned to */
    declaredName?: string;
    constructor(node: es.ArrowFunctionExpression, environment: Environment, context: Context, predefined?: boolean);
    static makeFromArrowFunction(node: es.ArrowFunctionExpression, environment: Environment, context: Context, dummyReturn?: boolean, predefined?: boolean): Closure;
}
export declare const isStatementSequence: (node: ControlItem) => node is StatementSequence;
