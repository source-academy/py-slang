import { Value } from './stash';
import * as es from 'estree';
import { Heap } from './heap';
import { Context } from './context';
import { Closure } from './closure';
import { Node } from './types';
export interface Frame {
    [name: string]: any;
}
export interface Environment {
    readonly id: string;
    name: string;
    tail: Environment | null;
    callExpression?: es.CallExpression;
    head: Frame;
    heap: Heap;
    thisContext?: Value;
}
export declare const uniqueId: (context: Context) => string;
export declare const createEnvironment: (context: Context, closure: Closure, args: Value[], callExpression: es.CallExpression) => Environment;
export declare const createSimpleEnvironment: (context: Context, name: string, tail?: Environment | null) => Environment;
export declare const createProgramEnvironment: (context: Context, isPrelude: boolean) => Environment;
export declare const createBlockEnvironment: (context: Context, name?: string) => Environment;
export declare const isRestElement: (node: Node) => node is es.RestElement;
export declare const handleArrayCreation: (context: Context, array: any[], envOverride?: Environment) => void;
export declare const currentEnvironment: (context: Context) => Environment;
export declare const popEnvironment: (context: Context) => Environment | undefined;
export declare const pushEnvironment: (context: Context, environment: Environment) => void;
