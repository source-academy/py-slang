import { Value } from './stash'
import { Heap } from './heap'
import { PyClosure } from './py_closure'
import { PyContext } from './py_context'
import { PyNode } from './py_types'
import { ExprNS, StmtNS } from '../ast-types'

export interface Frame {
  [name: string]: any
}

export interface PyEnvironment {
  readonly id: string
  name: string
  tail: PyEnvironment | null
  callExpression?: ExprNS.Call
  head: Frame
  heap: Heap
  thisContext?: Value
  closure?: PyClosure
}

export const uniqueId = (context: PyContext): string => {
  return `${context.runtime.objectCount++}`
}

export const createEnvironment = (
  context: PyContext,
  closure: PyClosure,
  args: Value[],
  callExpression: ExprNS.Call
): PyEnvironment => {
  const environment: PyEnvironment = {
    name:
      closure.node.constructor.name === 'FunctionDef'
        ? (closure.node as StmtNS.FunctionDef).name.lexeme
        : 'lambda',
    tail: closure.environment,
    head: {},
    heap: new Heap(),
    id: uniqueId(context),
    callExpression: callExpression,
    closure: closure
  }

  closure.node.parameters.forEach((paramToken, index) => {
    const paramName = paramToken.lexeme
    environment.head[paramName] = args[index]
  })
  return environment
}

export const createSimpleEnvironment = (
  context: PyContext,
  name: string,
  tail: PyEnvironment | null = null
): PyEnvironment => {
  return {
    id: uniqueId(context),
    name,
    tail,
    head: {},
    heap: new Heap()
    // TODO: callExpression and thisContext are optional and can be provided as needed.
  }
}

export const createProgramEnvironment = (context: PyContext, isPrelude: boolean): PyEnvironment => {
  return createSimpleEnvironment(context, isPrelude ? 'prelude' : 'programEnvironment')
}

export const createBlockEnvironment = (
  context: PyContext,
  name = 'blockEnvironment'
): PyEnvironment => {
  return {
    name,
    tail: currentEnvironment(context),
    head: {},
    heap: new Heap(),
    id: uniqueId(context)
  }
}

// export const isRestElement = (node: Node): node is es.RestElement => {
//   return (node as es.RestElement).type === 'RestElement';
// };

// export const handleArrayCreation = (
//   context: PyContext,
//   array: any[],
//   envOverride?: PyEnvironment
// ): void => {
//   const environment = envOverride ?? currentEnvironment(context);
//   Object.defineProperties(array, {
//     id: { value: uniqueId(context) },
//     environment: { value: environment, writable: true }
//   });
//   environment.heap.add(array as any);
// };

export const currentEnvironment = (context: PyContext): PyEnvironment => {
  return context.runtime.environments[0]
}

export const getGlobalEnvironment = (context: PyContext): PyEnvironment | null => {
  const envs = context.runtime.environments;
  return envs.length > 0 ? envs[envs.length - 1] : null;
};

export const popEnvironment = (context: PyContext) => context.runtime.environments.shift()

export const pushEnvironment = (context: PyContext, environment: PyEnvironment) => {
  context.runtime.environments.unshift(environment)
  context.runtime.environmentTree.insert(environment)
}
