// closure.ts

import * as es from 'estree'
import { Environment } from './environment'
import { Context } from './context' // 假设 Context 定义在 context.ts 中
import { StatementSequence } from './types'
import { blockArrowFunction, blockStatement, hasReturnStatement, identifier, isBlockStatement, returnStatement } from './ast-helper'
import { ControlItem } from './control'

export class Closure {
  public originalNode?: es.ArrowFunctionExpression

  /** Unique ID defined for closure */
  //public readonly id: string

  /** Name of the constant declaration that the closure is assigned to */
  public declaredName?: string

  constructor(
    public node: es.ArrowFunctionExpression,
    public environment: Environment,
    public context: Context,
    public predefined: boolean = false
) {
      this.originalNode = node
  } 

  static makeFromArrowFunction(
    node: es.ArrowFunctionExpression,
    environment: Environment,
    context: Context,
    dummyReturn: boolean = false,
    predefined: boolean = false
  ): Closure {
    const functionBody: es.BlockStatement | StatementSequence =
      !isBlockStatement(node.body) && !isStatementSequence(node.body)
        ? blockStatement([returnStatement(node.body, node.body.loc)], node.body.loc)
        : dummyReturn && !hasReturnStatement(node.body)
        ? blockStatement(
            [
              ...node.body.body,
              returnStatement(identifier('undefined', node.body.loc), node.body.loc)
            ],
            node.body.loc
          )
        : node.body

    const closure = new Closure(blockArrowFunction(node.params as es.Identifier[], functionBody, node.loc), 
      environment, context, predefined)

    closure.originalNode = node

    return closure
  }
}

export const isStatementSequence = (node: ControlItem): node is StatementSequence => {
  return (node as StatementSequence).type == 'StatementSequence'
}
