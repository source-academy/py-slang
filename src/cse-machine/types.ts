import { ExprNS, StmtNS } from "../ast-types";
import { TokenType } from "../tokens";
import { Environment } from "./environment";
import { Value } from "./stash";

export type Node = { isEnvDependent?: boolean } & (StmtNS.Stmt | ExprNS.Expr | StatementSequence);

export interface StatementSequence {
  type: "StatementSequence";
  body: StmtNS.Stmt[];
  loc?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

export enum InstrType {
  RESET = "Reset",
  WHILE = "WhileInstr",
  FOR = "ForInstr",
  ASSIGNMENT = "Assignment",
  ANN_ASSIGNMENT = "AnnAssignment",
  LIST_ASSIGNMENT = "ListAssignment",
  APPLICATION = "Application",
  UNARY_OP = "UnaryOperation",
  BINARY_OP = "BinaryOperation",
  BOOL_OP = "BoolOperation",
  COMPARE = "Compare",
  CALL = "Call",
  RETURN = "Return",
  BREAK = "BreakInstr",
  CONTINUE = "ContinueInstr",
  IF = "If",
  FUNCTION_DEF = "FunctionDef",
  LAMBDA = "Lambda",
  LIST = "ListLiteral",
  MULTI_LAMBDA = "MultiLambda",
  GROUPING = "Grouping",
  LITERAL = "Literal",
  VARIABLE = "Variable",
  TERNARY = "Ternary",
  PASS = "Pass",
  ASSERT = "Assert",
  IMPORT = "Import",
  GLOBAL = "Global",
  NONLOCAL = "NonLocal",
  Program = "Program",
  BRANCH = "Branch",
  POP = "Pop",
  ENVIRONMENT = "environment",
  MARKER = "marker",
  END_OF_FUNCTION_BODY = "EndOfFunctionBody",
  LIST_ACCESS = "ListAccess",
}

interface BaseInstr {
  instrType: InstrType;
  srcNode: Node;
  isEnvDependent?: boolean;
}

export interface WhileInstr extends BaseInstr {
  instrType: InstrType.WHILE;
  test: ExprNS.Expr;
  body: StatementSequence;
}

export interface ForInstr extends BaseInstr {
  instrType: InstrType.FOR;
  init: ExprNS.Variable;
  test: ExprNS.Expr;
  update: Node;
  body: StatementSequence;
}

export interface ContinueInstr extends BaseInstr {
  instrType: InstrType.CONTINUE;
}

export interface BreakInstr extends BaseInstr {
  instrType: InstrType.BREAK;
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

export interface AppInstr extends BaseInstr {
  instrType: InstrType.APPLICATION;
  numOfArgs: number;
  srcNode: Node;
}

export interface BranchInstr extends BaseInstr {
  instrType: InstrType.BRANCH;
  consequent: Node;
  alternate: Node | null | undefined;
}

export interface ListInstr extends BaseInstr {
  instrType: InstrType.LIST;
  numOfElements: number;
}

export interface ListAccessInstr extends BaseInstr {
  instrType: InstrType.LIST_ACCESS;
}

export interface ListAssmtInstr extends BaseInstr {
  instrType: InstrType.LIST_ASSIGNMENT;
}

export interface EnvInstr extends BaseInstr {
  instrType: InstrType.ENVIRONMENT;
  env: Environment;
}

export interface ArrLitInstr extends BaseInstr {
  arity: number;
}

export interface EndOfFunctionBodyInstr extends BaseInstr {
  instrType: InstrType.END_OF_FUNCTION_BODY;
}

export interface ResetInstr extends BaseInstr {
  instrType: InstrType.RESET;
}

export interface PopInstr extends BaseInstr {
  instrType: InstrType.POP;
}

export interface BoolOpInstr extends BaseInstr {
  instrType: InstrType.BOOL_OP;
  symbol: TokenType;
}

export type Instr =
  | BaseInstr
  | WhileInstr
  | ForInstr
  | AssmtInstr
  | UnOpInstr
  | BinOpInstr
  | AppInstr
  | BranchInstr
  | EnvInstr
  | ArrLitInstr
  | EndOfFunctionBodyInstr
  | ResetInstr
  | PopInstr
  | BoolOpInstr;

export function typeTranslator(type: Value["type"]): string {
  switch (type) {
    case "bigint":
      return "int";
    case "number":
      return "float";
    case "bool":
      return "bool";
    case "string":
      return "str";
    case "complex":
      return "complex";
    case "none":
      return "NoneType";
    case "closure":
      return "function";
    default:
      return "unknown";
  }
}

export function operatorTranslator(operator: TokenType | string) {
  switch (operator) {
    case TokenType.PLUS:
      return "+";
    case TokenType.MINUS:
      return "-";
    case TokenType.STAR:
      return "*";
    case TokenType.SLASH:
      return "/";
    case TokenType.DOUBLESLASH:
      return "//";
    case TokenType.PERCENT:
      return "%";
    case TokenType.DOUBLESTAR:
      return "**";
    case TokenType.LESS:
      return "<";
    case TokenType.GREATER:
      return ">";
    case TokenType.DOUBLEEQUAL:
      return "==";
    case TokenType.NOTEQUAL:
      return "!=";
    case TokenType.LESSEQUAL:
      return "<=";
    case TokenType.GREATEREQUAL:
      return ">=";
    case TokenType.NOT:
      return "not";
    case TokenType.AND:
      return "and";
    case TokenType.OR:
      return "or";
    default:
      return String(operator);
  }
}
