import { Environment } from './environment'
import {
  AppInstr,
  AssmtInstr,
  BinOpInstr,
  BranchInstr,
  EnvInstr,
  Instr,
  InstrType,
  PyNode,
  UnOpInstr,
  BoolOpInstr,
  EndOfFunctionBodyInstr
} from './py_types'
import { TokenType } from '../tokens'

export const popInstr = (srcNode: PyNode): Instr => ({
  instrType: InstrType.POP,
  srcNode
})

export const assmtInstr = (
  symbol: string,
  constant: boolean,
  declaration: boolean,
  srcNode: PyNode
): AssmtInstr => ({
  instrType: InstrType.ASSIGNMENT,
  symbol,
  constant,
  declaration,
  srcNode
})

export const appInstr = (numOfArgs: number, srcNode: PyNode): AppInstr => ({
  instrType: InstrType.APPLICATION,
  numOfArgs,
  srcNode
})

export const envInstr = (env: Environment, srcNode: PyNode): EnvInstr => ({
  instrType: InstrType.ENVIRONMENT,
  env,
  srcNode
})

export const markerInstr = (srcNode: PyNode): Instr => ({
  instrType: InstrType.MARKER,
  srcNode
})

export const binOpInstr = (symbol: any, srcNode: PyNode): BinOpInstr => ({
  instrType: InstrType.BINARY_OP,
  symbol,
  srcNode
})

export const resetInstr = (srcNode: PyNode): Instr => ({
  instrType: InstrType.RESET,
  srcNode
})

export const branchInstr = (
  consequent: PyNode,
  alternate: PyNode | null | undefined,
  srcNode: PyNode
): BranchInstr => ({
  instrType: InstrType.BRANCH,
  consequent,
  alternate,
  srcNode
})

export const unOpInstr = (symbol: TokenType, srcNode: PyNode): UnOpInstr => ({
  instrType: InstrType.UNARY_OP,
  symbol,
  srcNode
})

export const boolOpInstr = (symbol: TokenType, srcNode: PyNode): BoolOpInstr => ({
  instrType: InstrType.BOOL_OP,
  symbol,
  srcNode
})

export const endOfFunctionBodyInstr = (srcNode: PyNode): EndOfFunctionBodyInstr => ({
  instrType: InstrType.END_OF_FUNCTION_BODY,
  srcNode
})
