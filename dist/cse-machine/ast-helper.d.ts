import type * as es from 'estree';
import { StatementSequence } from './types';
import { ControlItem } from './control';
/**
 * Create a StatementSequence node.
 */
export declare const statementSequence: (body: es.Statement[], loc?: es.SourceLocation | null) => StatementSequence;
export declare const isNode: (item: any) => item is es.Node;
export declare const isBlockStatement: (node: es.Node | StatementSequence) => node is es.BlockStatement;
export declare const hasDeclarations: (node: es.BlockStatement) => boolean;
export declare const blockArrowFunction: (params: es.Identifier[], body: es.Statement[] | es.BlockStatement | es.Expression, loc?: es.SourceLocation | null) => es.ArrowFunctionExpression;
export declare const blockStatement: (body: es.Statement[], loc?: es.SourceLocation | null) => es.BlockStatement;
export declare const constantDeclaration: (name: string, init: es.Expression, loc?: es.SourceLocation | null) => pyVariableDeclaration;
export declare const declaration: (name: string, kind: AllowedDeclarations, init: es.Expression, loc?: es.SourceLocation | null) => pyVariableDeclaration;
type AllowedDeclarations = 'declaration' | 'const';
export interface pyVariableDeclaration {
    type: "VariableDeclaration";
    declarations: pyVariableDeclarator[];
    kind: "declaration" | "const";
    loc?: es.SourceLocation | null | undefined;
    range?: [number, number] | undefined;
}
export interface pyVariableDeclarator {
    type: "VariableDeclarator";
    id: Pattern;
    init?: es.Expression | null | undefined;
}
export type Pattern = es.Identifier | es.ObjectPattern | es.ArrayPattern | es.RestElement | es.AssignmentPattern | es.MemberExpression;
export declare const identifier: (name: string, loc?: es.SourceLocation | null) => es.Identifier;
export declare const returnStatement: (argument: es.Expression, loc?: es.SourceLocation | null) => es.ReturnStatement;
export declare const hasReturnStatement: (block: es.BlockStatement | StatementSequence) => boolean;
export declare const isReturnStatement: (node: es.Node) => node is es.ReturnStatement;
export declare const isIfStatement: (node: es.Node) => node is es.IfStatement;
export declare const hasReturnStatementIf: (statement: es.IfStatement) => boolean;
export declare const isStatementSequence: (node: ControlItem) => node is StatementSequence;
export declare const literal: (value: string | number | boolean | null, loc?: es.SourceLocation | null) => es.Literal;
export {};
