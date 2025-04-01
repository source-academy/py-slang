import { ExprNS, StmtNS } from '../ast-types';
import { Token } from '../tokenizer';
import type * as es from 'estree';
import { Stack } from './stack';
import { isNode, isBlockStatement, hasDeclarations, statementSequence } from './ast-helper';
import { Environment } from './environment';

export type Node = { isEnvDependent?: boolean } & (
    | es.Node
    | StatementSequence
);

export interface StatementSequence extends es.BaseStatement {
    type: 'StatementSequence';
    body: es.Statement[];
    innerComments?: es.Comment[] | undefined;
    // isEnvDependent?: boolean
}

export enum InstrType {
    RESET = 'Reset',
    WHILE = 'While',
    FOR = 'For',
    ASSIGNMENT = 'Assignment',
    ANN_ASSIGNMENT = 'AnnAssignment',
    APPLICATION = 'Application',
    UNARY_OP = 'UnaryOperation',
    BINARY_OP = 'BinaryOperation',
    BOOL_OP = 'BoolOperation',
    COMPARE = 'Compare',
    CALL = 'Call',
    RETURN = 'Return',
    BREAK = 'Break',
    CONTINUE = 'Continue',
    IF = 'If',
    FUNCTION_DEF = 'FunctionDef',
    LAMBDA = 'Lambda',
    MULTI_LAMBDA = 'MultiLambda',
    GROUPING = 'Grouping',
    LITERAL = 'Literal',
    VARIABLE = 'Variable',
    TERNARY = 'Ternary',
    PASS = 'Pass',
    ASSERT = 'Assert',
    IMPORT = 'Import',
    GLOBAL = 'Global',
    NONLOCAL = 'NonLocal',
    Program = 'Program',
    BRANCH = 'Branch',
    POP = 'Pop',
    ENVIRONMENT = 'environment',
    MARKER = 'marker',
}

interface BaseInstr {
  instrType: InstrType
  srcNode: Node
  isEnvDependent?: boolean
}

export interface WhileInstr extends BaseInstr {
  test: es.Expression
  body: es.Statement
}

export interface ForInstr extends BaseInstr {
  init: es.VariableDeclaration | es.Expression
  test: es.Expression
  update: es.Expression
  body: es.Statement
}

export interface AssmtInstr extends BaseInstr {
  symbol: string
  constant: boolean
  declaration: boolean
}

export interface UnOpInstr extends BaseInstr {
  symbol: es.UnaryOperator
}

export interface BinOpInstr extends BaseInstr {
  symbol: es.Identifier
}

export interface AppInstr extends BaseInstr {
  numOfArgs: number
  srcNode: es.CallExpression
}

export interface BranchInstr extends BaseInstr {
  consequent: es.Expression | es.Statement
  alternate: es.Expression | es.Statement | null | undefined
}

export interface EnvInstr extends BaseInstr {
  env: Environment
}

export interface ArrLitInstr extends BaseInstr {
  arity: number
}

export interface AssmtInstr extends BaseInstr {
  symbol: string
  constant: boolean
  declaration: boolean
}

export type Instr =
  | BaseInstr
  | WhileInstr
  | AssmtInstr
  | AppInstr
  | BranchInstr
  | EnvInstr
  | ArrLitInstr