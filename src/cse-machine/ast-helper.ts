// astHelpers.ts
import type * as es from 'estree';
import { StatementSequence } from './types';
import { ControlItem } from './control';

/**
 * Create a StatementSequence node.
 */
export const statementSequence = (
  body: es.Statement[],
  loc?: es.SourceLocation | null
): StatementSequence => ({
  type: 'StatementSequence',
  body,
  loc,
  innerComments: undefined,
});

export const isNode = (item: any): item is es.Node => {
  return typeof item === 'object' && item !== null && 'type' in item;
};

export const isBlockStatement = (node: es.Node | StatementSequence): node is es.BlockStatement => {
  return node.type === 'BlockStatement';
};

export const hasDeclarations = (node: es.BlockStatement): boolean => {
  return node.body.some(stmt => stmt.type === 'VariableDeclaration' || stmt.type === 'FunctionDeclaration');
};

export const blockArrowFunction = (
  params: es.Identifier[],
  body: es.Statement[] | es.BlockStatement | es.Expression,
  loc?: es.SourceLocation | null
): es.ArrowFunctionExpression => ({
  type: 'ArrowFunctionExpression',
  expression: false,
  generator: false,
  params,
  body: Array.isArray(body) ? blockStatement(body) : body,
  loc
})

export const blockStatement = (
  body: es.Statement[],
  loc?: es.SourceLocation | null
): es.BlockStatement => ({
  type: 'BlockStatement',
  body,
  loc
})

export const constantDeclaration = (
  name: string,
  init: es.Expression,
  loc?: es.SourceLocation | null
) => declaration(name, 'declaration', init, loc)

export const declaration = (
  name: string,
  kind: AllowedDeclarations,
  init: es.Expression,
  loc?: es.SourceLocation | null
): pyVariableDeclaration => ({
  type: 'VariableDeclaration',
  declarations: [
    {
      type: 'VariableDeclarator',
      id: identifier(name),
      init
    }
  ],
  kind: 'declaration',
  loc
})

type AllowedDeclarations = 'declaration' | 'const'

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

export const identifier = (name: string, loc?: es.SourceLocation | null): es.Identifier => ({
  type: 'Identifier',
  name,
  loc
})

export const returnStatement = (
  argument: es.Expression,
  loc?: es.SourceLocation | null
): es.ReturnStatement => ({
  type: 'ReturnStatement',
  argument,
  loc
})

export const hasReturnStatement = (block: es.BlockStatement | StatementSequence): boolean => {
  let hasReturn = false
  for (const statement of block.body) {
    if (isReturnStatement(statement)) {
      hasReturn = true
    } else if (isIfStatement(statement)) {
      // Parser enforces that if/else have braces (block statement)
      hasReturn = hasReturn || hasReturnStatementIf(statement as es.IfStatement)
    } else if (isBlockStatement(statement) || isStatementSequence(statement)) {
      hasReturn = hasReturn && hasReturnStatement(statement)
    }
  }
  return hasReturn
}

export const isReturnStatement = (node: es.Node): node is es.ReturnStatement => {
  return (node as es.ReturnStatement).type == 'ReturnStatement'
}

export const isIfStatement = (node: es.Node): node is es.IfStatement => {
  return (node as es.IfStatement).type == 'IfStatement'
}

export const hasReturnStatementIf = (statement: es.IfStatement): boolean => {
  let hasReturn = true
  // Parser enforces that if/else have braces (block statement)
  hasReturn = hasReturn && hasReturnStatement(statement.consequent as es.BlockStatement)
  if (statement.alternate) {
    if (isIfStatement(statement.alternate)) {
      hasReturn = hasReturn && hasReturnStatementIf(statement.alternate as es.IfStatement)
    } else if (isBlockStatement(statement.alternate) || isStatementSequence(statement.alternate)) {
      hasReturn = hasReturn && hasReturnStatement(statement.alternate)
    }
  }
  return hasReturn
}

export const isStatementSequence = (node: ControlItem): node is StatementSequence => {
  return (node as StatementSequence).type == 'StatementSequence'
}

export const literal = (
  value: string | number | boolean | null,
  loc?: es.SourceLocation | null
): es.Literal => ({
  type: 'Literal',
  value,
  loc
})
