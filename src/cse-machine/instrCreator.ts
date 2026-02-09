import { Environment } from './environment'
import {
  AppInstr,
  AssmtInstr,
  BinOpInstr,
  BoolOpInstr,
  BranchInstr,
  EndOfFunctionBodyInstr,
  EnvInstr,
  Instr,
  InstrType,
  Node,
  UnOpInstr,
} from './types'
import { TokenType } from '../tokens'

export const popInstr = (srcNode: Node): Instr => ({instrType: InstrType.POP, srcNode })

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

export const appInstr = (numOfArgs: number, srcNode: Node): AppInstr => ({
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
  consequent: Node,
  alternate: Node | null | undefined,
  srcNode: Node
): BranchInstr => ({
  instrType: InstrType.BRANCH,
  consequent,
  alternate,
  srcNode
})

export const unOpInstr = (symbol: TokenType, srcNode: Node): UnOpInstr => ({
  instrType: InstrType.UNARY_OP,
  symbol,
  srcNode
})

export const boolOpInstr = (symbol: TokenType, srcNode: Node): BoolOpInstr => ({
  instrType: InstrType.BOOL_OP,
  symbol,
  srcNode
})

export const endOfFunctionBodyInstr = (srcNode: Node): EndOfFunctionBodyInstr => ({
  instrType: InstrType.END_OF_FUNCTION_BODY,
  srcNode
})
