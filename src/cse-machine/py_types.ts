import { Environment } from './environment';
import { StmtNS, ExprNS } from '../ast-types';
import { TokenType } from '../tokens';

export type PyNode = StmtNS.Stmt | ExprNS.Expr | StatementSequence;

export interface StatementSequence {
       type: 'StatementSequence';
       body: StmtNS.Stmt[];
       loc?: {
           start: { line: number; column: number };
           end: { line: number; column: number };
       };
   }

export enum InstrType {
    END_OF_FUNCTION_BODY = "EndOfFunctionBody",
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
  srcNode: PyNode
  isEnvDependent?: boolean
}

export interface WhileInstr extends BaseInstr {
  test: PyNode
  body: PyNode
}

// TODO: more strict type in the future
export interface ForInstr extends BaseInstr {
  init: PyNode
  test: PyNode
  update: PyNode
  body: PyNode
}

export interface AssmtInstr extends BaseInstr {
  instrType: InstrType.ASSIGNMENT;
  symbol: string;
  constant: boolean;
  declaration: boolean;
}

export interface UnOpInstr extends BaseInstr {
  instrType: InstrType.UNARY_OP;
  symbol: TokenType;
}

export interface BinOpInstr extends BaseInstr {
  instrType: InstrType.BINARY_OP;
  symbol: TokenType;
}

export interface BoolOpInstr extends BaseInstr {
  instrType: InstrType.BOOL_OP;
  symbol: TokenType;
}

export interface AppInstr extends BaseInstr {
  instrType: InstrType.APPLICATION;
  numOfArgs: number;
  srcNode: PyNode;
}

export interface EndOfFunctionBodyInstr extends BaseInstr {
  instrType: InstrType.END_OF_FUNCTION_BODY;
}

export interface ResetInstr extends BaseInstr {
  instrType: InstrType.RESET;
}

export interface BranchInstr extends BaseInstr {
  consequent: PyNode
  alternate: PyNode | null | undefined
}

export interface EnvInstr extends BaseInstr {
  env: Environment
}

export interface ArrLitInstr extends BaseInstr {
  arity: number
}

export type Instr =
  | BaseInstr
  | WhileInstr
  | ForInstr
  | AssmtInstr
  | AppInstr
  | EndOfFunctionBodyInstr
  | ResetInstr
  | BranchInstr
  | EnvInstr
  | ArrLitInstr
  | UnOpInstr
  | BinOpInstr
  | BoolOpInstr