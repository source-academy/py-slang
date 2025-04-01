import { Value } from './stash';
import * as es from 'estree';
import { Heap } from './heap';
import { Context } from './context';
import { Control } from './control';
import { Closure } from './closure';
import { isIdentifier } from './utils';
import { Node } from './types';

export interface Frame {
  [name: string]: any
}

export interface Environment {
  readonly id: string
  name: string
  tail: Environment | null
  callExpression?: es.CallExpression
  head: Frame
  heap: Heap
  thisContext?: Value
}

export const uniqueId = (context: Context): string => {
  return `${context.runtime.objectCount++}`
}

export const createEnvironment = (
  context: Context,
  closure: Closure,
  args: Value[],
  callExpression: es.CallExpression
): Environment => {
  const environment: Environment = {
    // TODO: name
    name: '',
    tail: closure.environment,
    head: {},
    heap: new Heap(),
    id: uniqueId(context),
    callExpression: {
      ...callExpression,
      //arguments: args.map(ast.primitive)
    }
  }
  
  // console.info('closure.node.params:', closure.node.params);
  // console.info('Number of params:', closure.node.params.length);

  closure.node.params.forEach((param, index) => {
    if (isRestElement(param)) {
      const array = args.slice(index)
      handleArrayCreation(context, array, environment)
      environment.head[(param.argument as es.Identifier).name] = array
    } else {
      environment.head[(param as es.Identifier).name] = args[index]
    }
  })
  return environment
}

export const createSimpleEnvironment = (
  context: Context,
  name: string,
  tail: Environment | null = null
): Environment => {
  return {
    id: uniqueId(context),
    name,
    tail,
    head: {},
    heap: new Heap(),
    // callExpression 和 thisContext 可选，根据需要传递
  };
};

export const createProgramEnvironment = (context: Context, isPrelude: boolean): Environment => {
  return createSimpleEnvironment(context, isPrelude ? 'prelude' : 'programEnvironment');
};

export const createBlockEnvironment = (
  context: Context,
  name = 'blockEnvironment'
): Environment => {
  return {
    name,
    tail: currentEnvironment(context),
    head: {},
    heap: new Heap(),
    id: uniqueId(context)
  }
}

export const isRestElement = (node: Node): node is es.RestElement => {
  return (node as es.RestElement).type === 'RestElement';
};

export const handleArrayCreation = (
  context: Context,
  array: any[],
  envOverride?: Environment
): void => {
  const environment = envOverride ?? currentEnvironment(context);
  Object.defineProperties(array, {
    id: { value: uniqueId(context) },
    environment: { value: environment, writable: true }
  });
  environment.heap.add(array as any); // 假设 heap.add 已定义
};

export const currentEnvironment = (context: Context): Environment => {
  return context.runtime.environments[0];
};

export const popEnvironment = (context: Context) => context.runtime.environments.shift()

export const pushEnvironment = (context: Context, environment: Environment) => {
  context.runtime.environments.unshift(environment)
  context.runtime.environmentTree.insert(environment)
}
