import { PyContext } from "./py_context";
import { Value } from "./stash";
import { PyNode } from "./py_types";
import { TokenType } from "../tokens";
import { RuntimeSourceError } from "../errors/runtimeSourceError";
import { currentEnvironment, Environment } from "./py_environment";
import { TypeError } from "../errors/errors";



export function handleRuntimeError (context: PyContext, error: RuntimeSourceError) {
  context.errors.push(error);
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
    switch (operand) {
      case "__py_adder": return "+";
      case "__py_minuser": return "-";
      case "__py_multiplier": return "*";
      case "__py_divider": return "/";
      case "__py_modder": return "%";
      case "__py_powerer": return "**";
      default: return operand;
    }
  }
  switch (operand) {
    case TokenType.LESS:
      return '<';
    case TokenType.GREATER:
      return '>';
    case TokenType.DOUBLEEQUAL:
      return '==';
    case TokenType.NOTEQUAL:
      return '!='
    case TokenType.LESSEQUAL:
      return '<=';
    case TokenType.GREATEREQUAL:
      return '>=';
    case TokenType.NOT:
      return 'not';
    default:
        return String(operand);
  }
}

export function pythonMod(a: number | bigint, b: number | bigint): number | bigint {
  if (typeof a === 'bigint' || typeof b === 'bigint') {
    const big_a = BigInt(a);
    const big_b = BigInt(b);
    const mod = big_a % big_b;

    if ((mod < 0n && big_b > 0n) || (mod > 0n && big_b < 0n)) {
      return mod + big_b;
    } else {
      return mod;
    }
  }
  // both are numbers
  const mod = a % b;
  if ((mod < 0 && b > 0) || (mod > 0 && b < 0)) {
    return mod + b;
  } else {
    return mod;
  }
}

export function pyDefineVariable(context: PyContext, name: string, value: Value) {
    const environment = currentEnvironment(context);
    Object.defineProperty(environment.head, name, {
        value: value,
        writable: true,
        enumerable: true
    });
}

export function pyGetVariable(context: PyContext, name: string, node: PyNode): Value {
    let environment: Environment | null = currentEnvironment(context);
    while (environment) {
        if (Object.prototype.hasOwnProperty.call(environment.head, name)) {
            return environment.head[name];
        } else {
            environment = environment.tail;
        }
    }
    // For now, we throw an error. We can change this to return undefined if needed.
    // handleRuntimeError(context, new TypeError(`name '${name} is not defined`, node as any, context as any, '', ''));
    return { type: 'error', message: `NameError: name '${name}' is not defined` };
}