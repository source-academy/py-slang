import type * as es from 'estree';
import { Environment } from './environment';
import { Control, ControlItem } from './control';
import { Instr, Node } from './types';
import { Context } from './context';
import { Value } from './stash';
import { Closure } from './closure';
import { RuntimeSourceError } from '../errors/runtimeSourceError';
export declare const isIdentifier: (node: Node) => node is es.Identifier;
type PropertySetter = Map<string, Transformer>;
type Transformer = (item: ControlItem) => ControlItem;
declare const propertySetter: PropertySetter;
export { propertySetter };
/**
 * Checks whether the evaluation of the given control item depends on the current environment.
 * The item is also considered environment dependent if its evaluation introduces
 * environment dependent items
 * @param item The control item to be checked
 * @return `true` if the item is environment depedent, else `false`.
 */
export declare function isEnvDependent(item: ControlItem | null | undefined): boolean;
export declare const envChanging: (command: ControlItem) => boolean;
export declare function declareFunctionsAndVariables(context: Context, node: es.BlockStatement, environment: Environment): void;
export declare function declareIdentifier(context: Context, name: string, node: Node, environment: Environment, constant?: boolean): Environment;
export declare const handleSequence: (seq: es.Statement[]) => ControlItem[];
export declare const valueProducing: (command: Node) => boolean;
export declare function defineVariable(context: Context, name: string, value: Value, constant: boolean | undefined, node: es.VariableDeclaration | es.ImportDeclaration): Environment;
export declare const getVariable: (context: Context, name: string, node: es.Identifier) => any;
export declare const checkStackOverFlow: (context: Context, control: Control) => void;
export declare const checkNumberOfArguments: (command: ControlItem, context: Context, callee: Closure | Value, args: Value[], exp: es.CallExpression) => undefined;
export declare const isInstr: (command: ControlItem) => command is Instr;
export declare const isSimpleFunction: (node: any) => boolean;
export declare const reduceConditional: (node: es.IfStatement | es.ConditionalExpression) => ControlItem[];
export declare const handleRuntimeError: (context: Context, error: RuntimeSourceError) => never;
export declare function pythonMod(a: any, b: any): any;
export declare function hasImportDeclarations(node: es.BlockStatement): boolean;
export declare const isImportDeclaration: (node: es.Program["body"][number]) => node is es.ImportDeclaration;
export declare function getModuleDeclarationSource(node: Exclude<es.ModuleDeclaration, es.ExportDefaultDeclaration>): string;
export declare class AssertionError extends RuntimeSourceError {
    readonly message: string;
    constructor(message: string);
    explain(): string;
    elaborate(): string;
}
export default function assert(condition: boolean, message: string): asserts condition;
