import { Context } from './context';
import { currentEnvironment, Environment } from './environment';
import { Value } from './stash';
import { Node } from './types';
import { ExprNS, StmtNS } from '../ast-types';
import { builtIns, builtInConstants } from '../stdlib';
import { NameError, UnboundLocalError } from '../errors/errors';

export function pythonMod(a: number | bigint, b: number | bigint): number | bigint {
  if (typeof a === 'bigint' || typeof b === 'bigint') {
    const big_a = BigInt(a)
    const big_b = BigInt(b)
    const mod = big_a % big_b

    if ((mod < 0n && big_b > 0n) || (mod > 0n && big_b < 0n)) {
      return mod + big_b
    } else {
      return mod
    }
  }
  // both are numbers
  const mod = a % b
  if ((mod < 0 && b > 0) || (mod > 0 && b < 0)) {
    return mod + b
  } else {
    return mod
  }
}

export function pyDefineVariable(
  context: Context,
  name: string,
  value: Value,
  env: Environment = currentEnvironment(context)
) {
  Object.defineProperty(env.head, name, {
    value: value,
    writable: true,
    enumerable: true
  })
}

export function pyGetVariable(code: string, context: Context, name: string, node: Node): Value {
  const env = currentEnvironment(context)
  if (env.closure && env.closure.localVariables.has(name)) {
    if (!env.head.hasOwnProperty(name)) {
      throw new UnboundLocalError(code, name, node as ExprNS.Variable)
    }
  }

  let currentEnv: Environment | null = env
  while (currentEnv) {
    if (Object.prototype.hasOwnProperty.call(currentEnv.head, name)) {
      return currentEnv.head[name]
    } else {
      currentEnv = currentEnv.tail
    }
  }
  if (builtIns.has(name)) {
    return builtIns.get(name)!
  }
  if (builtInConstants.has(name)) {
    return builtInConstants.get(name)!
  }
  throw new NameError(code, name, node as ExprNS.Variable)
}

export function scanForAssignments(node: Node | Node[]): Set<string> {
  const assignments = new Set<string>()
  const visitor = (curNode: Node) => {
    if (!curNode || typeof curNode !== 'object') {
      return
    }

    const nodeType = curNode.constructor.name

    if (nodeType === 'Assign') {
      assignments.add((curNode as StmtNS.Assign).name.lexeme)
    } else if (nodeType === 'FunctionDef' || nodeType === 'Lambda') {
      // detach here, nested functions have their own scope
      return
    }

    // Recurse through all other properties of the node
    for (const key in curNode) {
      if (Object.prototype.hasOwnProperty.call(curNode, key)) {
        const child = (curNode as any)[key]
        if (Array.isArray(child)) {
          child.forEach(visitor)
        } else if (child && typeof child === 'object' && child.hasOwnProperty('type')) {
          visitor(child)
        }
      }
    }
  }

  if (Array.isArray(node)) {
    node.forEach(visitor)
  } else {
    visitor(node)
  }

  return assignments
}
