import { PyContext } from "./py_context";
import { Value } from "./stash";
import { PyNode } from "./py_types";
import { TokenType } from "../tokens";
import { PyRuntimeSourceError } from "../errors/py_runtimeSourceError";
import { currentEnvironment, PyEnvironment } from "./py_environment";
import { builtIns } from "../py_stdlib";
import { StmtNS, ExprNS } from "../ast-types";
import { UnboundLocalError, NameError } from "../errors/py_errors";


export function pyHandleRuntimeError (context: PyContext, error: PyRuntimeSourceError) {
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
      return "str";
    case "complex":
      return "complex";
    case "undefined":
      return "NoneType";
    default:
      return "unknown";
  }
}

// TODO: properly adapt for the rest, string is passed in to cater for __py_adder etc...
export function operatorTranslator(operator: TokenType | string) {
  switch (operator) {
    case TokenType.PLUS:
      return '+';
    case TokenType.MINUS:
      return '-';
    case TokenType.STAR:
      return '*';
    case TokenType.SLASH:
      return '/';
    case TokenType.DOUBLESLASH:
      return '//';
    case TokenType.PERCENT:
      return '%';
    case TokenType.DOUBLESTAR:
      return '**';  
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
    case TokenType.AND:
      return 'and';
    case TokenType.OR:
      return 'or';
    default:
        return String(operator);
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

export function pyGetVariable(code: string, context: PyContext, name: string, node: PyNode): Value {
    const env = currentEnvironment(context);
    // UnboundLocalError check
    if (env.closure && env.closure.localVariables.has(name)) {
        if (!env.head.hasOwnProperty(name)) {
            throw new UnboundLocalError(code, name, node as ExprNS.Variable);
        }
    }

    let currentEnv: PyEnvironment | null = env;
    while (currentEnv) {
        if (Object.prototype.hasOwnProperty.call(currentEnv.head, name)) {
            return currentEnv.head[name];
        } else {
            currentEnv = currentEnv.tail;
        }
    }
    if (builtIns.has(name)) {
        return builtIns.get(name)!;
    }
    throw new NameError(code, name, node as ExprNS.Variable);
}

export function scanForAssignments(node: PyNode | PyNode[]): Set<string> {
    const assignments = new Set<string>();
    const visitor = (curNode: PyNode) => {
        if (!curNode || typeof curNode !== 'object') {
          return;
        }

        const nodeType = curNode.constructor.name;

        if (nodeType === 'Assign') {
            assignments.add((curNode as StmtNS.Assign).name.lexeme);
        } else if (nodeType === 'FunctionDef' || nodeType === 'Lambda') {
            // detach here, nested functions have their own scope
            return;
        }

        // Recurse through all other properties of the node
        for (const key in curNode) {
            if (Object.prototype.hasOwnProperty.call(curNode, key)) {
                const child = (curNode as any)[key];
                if (Array.isArray(child)) {
                    child.forEach(visitor);
                } else if (child && typeof child === 'object' && child.hasOwnProperty('type')) {
                        visitor(child);
                }
            }
        }
    };

    if (Array.isArray(node)) {
        node.forEach(visitor);
    } else {
        visitor(node);
    }

    return assignments;
}