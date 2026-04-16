import { ExprNS, StmtNS } from "../../ast-types";
import { TokenType } from "../../tokens";
import { Environment } from "./environment";
import {
  AppInstr,
  AssmtInstr,
  BinOpInstr,
  BoolOpInstr,
  BranchInstr,
  BreakInstr,
  ContinueInstr,
  ContinueMarkerInstr,
  EndOfFunctionBodyInstr,
  EnvInstr,
  ForInstr,
  Instr,
  InstrType,
  ListAccessInstr,
  ListAssmtInstr,
  ListInstr,
  Node,
  StatementSequence,
  UnOpInstr,
  WhileInstr,
} from "./types";

export const popInstr = (srcNode: Node): Instr => ({ instrType: InstrType.POP, srcNode });

export const assmtInstr = (
  symbol: string,
  constant: boolean,
  declaration: boolean,
  srcNode: Node,
): AssmtInstr => ({
  instrType: InstrType.ASSIGNMENT,
  symbol,
  constant,
  declaration,
  srcNode,
});

export const appInstr = (
  numOfArgs: number,
  srcNode: Node,
  spreadIndices: number[] = [],
): AppInstr => ({
  instrType: InstrType.APPLICATION,
  numOfArgs,
  spreadIndices,
  srcNode,
});

export const breakInstr = (srcNode: Node): BreakInstr => ({
  instrType: InstrType.BREAK,
  srcNode,
});

export const envInstr = (env: Environment, srcNode: Node): EnvInstr => ({
  instrType: InstrType.ENVIRONMENT,
  env,
  srcNode,
});

export const continueMarkerInstr = (srcNode: Node): ContinueMarkerInstr => ({
  instrType: InstrType.CONTINUE_MARKER,
  srcNode,
});

export const continueInstr = (srcNode: Node): ContinueInstr => ({
  instrType: InstrType.CONTINUE,
  srcNode,
});

export const binOpInstr = (symbol: TokenType, srcNode: Node): BinOpInstr => ({
  instrType: InstrType.BINARY_OP,
  symbol,
  srcNode,
});

export const resetInstr = (srcNode: Node): Instr => ({
  instrType: InstrType.RESET,
  srcNode,
});

export const branchInstr = (
  consequent: Node,
  alternate: Node | null | undefined,
  srcNode: Node,
): BranchInstr => ({
  instrType: InstrType.BRANCH,
  consequent,
  alternate,
  srcNode,
});

export const listInstr = (numOfElements: number, srcNode: Node): ListInstr => ({
  instrType: InstrType.LIST,
  numOfElements,
  srcNode,
});

export const unOpInstr = (symbol: TokenType, srcNode: Node): UnOpInstr => ({
  instrType: InstrType.UNARY_OP,
  symbol,
  srcNode,
});

export const boolOpInstr = (symbol: TokenType, srcNode: Node): BoolOpInstr => ({
  instrType: InstrType.BOOL_OP,
  symbol,
  srcNode,
});

export const listAccessInstr = (srcNode: Node): ListAccessInstr => ({
  instrType: InstrType.LIST_ACCESS,
  srcNode,
});

export const listAssmtInstr = (srcNode: Node): ListAssmtInstr => ({
  instrType: InstrType.LIST_ASSIGNMENT,
  srcNode,
});

export const endOfFunctionBodyInstr = (srcNode: Node): EndOfFunctionBodyInstr => ({
  instrType: InstrType.END_OF_FUNCTION_BODY,
  srcNode,
});

export const forInstr = (srcNode: Node, body: StmtNS.Stmt[]): ForInstr => ({
  instrType: InstrType.FOR,
  srcNode,
  body,
});

export const whileInstr = (
  srcNode: Node,
  test: ExprNS.Expr,
  body: StatementSequence,
): WhileInstr => ({
  instrType: InstrType.WHILE,
  srcNode,
  test,
  body,
});
