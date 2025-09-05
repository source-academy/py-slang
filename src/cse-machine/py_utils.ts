import { Context } from "./context";
import { ExprNS } from "../ast-types";
import { TokenType } from "../tokens";
import { UnsupportedOperandTypeError } from "../errors/errors";

export function handleRuntimeError (context: Context, error: any) {
  throw error;
}

export function typeTranslator(type: string): string {
  switch (type) {
    case "bigint":
      return "int";
    case "number":
      return "float";
    case "boolean":
      return "bool";
    case "bool":
      return "bool";
    case "string":
      return "string";
    case "complex":
      return "complex";
    default:
      return "unknown";
  }
}

// TODO: properly adapt for the rest, string is passed in to cater for __py_adder etc...
export function operandTranslator(operand: TokenType | string) {
  if (typeof operand === 'string') {
    return operand;
  }
  switch (operand) {
    case TokenType.PLUS:
      return '+';
    case TokenType.MINUS:
      return '-';
    case TokenType.STAR:
      return '*';
    case TokenType.SLASH:
      return '/';
    case TokenType.LESS:
      return '<';
    case TokenType.GREATER:
      return '>';
    case TokenType.PERCENT:
      return '%';
    case TokenType.DOUBLEEQUAL:
      return '==';
    case TokenType.NOTEQUAL:
      return '!='
    case TokenType.LESSEQUAL:
      return '<=';
    case TokenType.GREATEREQUAL:
      return '>=';
    case TokenType.DOUBLESTAR:
      return '**';
    case TokenType.NOT:
      return 'not';
    case TokenType.DOUBLESLASH:
      return '//';
    default:
        return String(operand);
  }
}

export function pythonMod(a: any, b: any): any {
  const mod = a % b;
  if ((mod >= 0 && b > 0) || (mod <= 0 && b < 0)) {
    return mod;
  } else {
    return mod + b;
  }
}
