import { Environment } from "./environment";
import { AppInstr, AssmtInstr, BinOpInstr, BranchInstr, EnvInstr, Instr, InstrType, Node, UnOpInstr } from "./types";
import type * as es from 'estree';

export const popInstr = (srcNode: Node): Instr => ({ instrType: InstrType.POP, srcNode })

export const assmtInstr = (
  symbol: string,
  constant: boolean,
  declaration: boolean,
  srcNode: Node
): AssmtInstr => ({
  instrType: InstrType.ASSIGNMENT,
  symbol,
  constant,
  declaration,
  srcNode
})

export const appInstr = (numOfArgs: number, srcNode: es.CallExpression): AppInstr => ({
  instrType: InstrType.APPLICATION,
  numOfArgs,
  srcNode
})

export const envInstr = (env: Environment, srcNode: Node): EnvInstr => ({
  instrType: InstrType.ENVIRONMENT,
  env,
  srcNode
})

export const markerInstr = (srcNode: Node): Instr => ({
  instrType: InstrType.MARKER,
  srcNode
})

export const binOpInstr = (symbol: any, srcNode: Node): BinOpInstr => ({
  instrType: InstrType.BINARY_OP,
  symbol,
  srcNode
})

export const resetInstr = (srcNode: Node): Instr => ({
  instrType: InstrType.RESET,
  srcNode
})

export const branchInstr = (
  consequent: es.Expression | es.Statement,
  alternate: es.Expression | es.Statement | null | undefined,
  srcNode: Node
): BranchInstr => ({
  instrType: InstrType.BRANCH,
  consequent,
  alternate,
  srcNode
})

export const conditionalExpression = (
  test: es.Expression,
  consequent: es.Expression,
  alternate: es.Expression,
  loc?: es.SourceLocation | null
): es.ConditionalExpression => ({
  type: 'ConditionalExpression',
  test,
  consequent,
  alternate,
  loc
})

export const unOpInstr = (symbol: es.UnaryOperator, srcNode: Node): UnOpInstr => ({
  instrType: InstrType.UNARY_OP,
  symbol,
  srcNode
})
