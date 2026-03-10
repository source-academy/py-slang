import { Closure } from './closure';
import { Context } from './context';
import { Heap } from './heap';
import { Value } from './stash';
import { ExprNS, StmtNS } from '../ast-types';
import { handleRuntimeError } from './error';
import { MissingRequiredPositionalError, TooManyPositionalArgumentsError, TypeError } from '../errors';

export interface Frame {
  [name: string]: Value
}

export interface Environment {
  readonly id: string
  name: string
  tail: Environment | null
  callExpression?: ExprNS.Call
  head: Frame
  heap: Heap
  thisContext?: Value
  closure?: Closure
}

export const uniqueId = (context: Context): string => {
  return `${context.runtime.objectCount++}`
}

export const createEnvironment = (
  source: string,
  context: Context,
  closure: Closure,
  args: Value[],
  callExpression: ExprNS.Call
): Environment => {
  const environment: Environment = {
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
  
  // console.info('closure.node.params:', closure.node.params);
  // console.info('Number of params:', closure.node.params.length);
  const isVariadic = closure.node.parameters.some(param => param.isStarred);
  let consumed = false;
  closure.node.parameters.forEach((paramToken, index) => {
    const paramName = paramToken.lexeme
    if (paramToken.isStarred) {
      environment.head[paramName] = { type: "list", value: args.slice(index) };
      consumed = true;
    }
    if (index >= args.length) {
      handleRuntimeError(context, 
          new MissingRequiredPositionalError(source, callExpression, environment.name, isVariadic ? index + 1 : closure.node.parameters.length, args, isVariadic));
    }
    if (!consumed) { // If we have already consumed the rest argument, the remaining are keyword-only arguments
      environment.head[paramName] = args[index];
    }
  })
  if (!isVariadic && args.length > closure.node.parameters.length) {
    handleRuntimeError(context, 
        new TooManyPositionalArgumentsError(source, callExpression, environment.name, closure.node.parameters.length, args, isVariadic));
  }

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
    // TODO: callExpression and thisContext are optional and can be provided as needed.
  };
};

export const createProgramEnvironment = (context: Context, isPrelude: boolean): Environment => {
  return createSimpleEnvironment(context, isPrelude ? 'prelude' : 'programEnvironment', isPrelude ? null : getPreludeEnvironment(context));
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
  environment.heap.add(array as any);
};

export const currentEnvironment = (context: Context): Environment => {
  return context.runtime.environments[0];
};

export const getGlobalEnvironment = (context: Context): Environment | null => {
  const envs = context.runtime.environments;
  return envs.length > 0 ? envs[envs.length - 1] : null;
};

export const getPreludeEnvironment = (context: Context): Environment | null => {
  const envs = context.runtime.environments;
  return envs.length > 1 ? envs[envs.length - 2] : null;
};

export const popEnvironment = (context: Context) => context.runtime.environments.shift()

export const pushEnvironment = (context: Context, environment: Environment) => {
  context.runtime.environments.unshift(environment)
  context.runtime.environmentTree.insert(environment)
}
