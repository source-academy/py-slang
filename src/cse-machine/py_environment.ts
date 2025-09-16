import { Value } from './stash';
import { Heap } from './heap';
// import { Closure } from './closure';
import { PyContext } from './py_context';
import { PyNode } from './py_types';
import { ExprNS } from '../ast-types';


export interface Frame {
  [name: string]: any
}

export interface Environment {
  readonly id: string
  name: string
  tail: Environment | null
  callExpression?: ExprNS.Call;
  head: Frame
  heap: Heap
  thisContext?: Value
}

export const uniqueId = (context: PyContext): string => {
  return `${context.runtime.objectCount++}`
}

// export const createEnvironment = (
//   context: PyContext,
//   closure: Closure,
//   args: Value[],
//   callExpression: ExprNS.Call
// ): Environment => {
//   const environment: Environment = {
//     // TODO: name
//     name: '',
//     tail: closure.environment,
//     head: {},
//     heap: new Heap(),
//     id: uniqueId(context),
//     callExpression: {
//       ...callExpression,
//       //arguments: args.map(ast.primitive)
//     }
//   }
  
//   // console.info('closure.node.params:', closure.node.params);
//   // console.info('Number of params:', closure.node.params.length);

//   closure.node.params.forEach((param, index) => {
//     if (isRestElement(param)) {
//       const array = args.slice(index)
//       handleArrayCreation(context, array, environment)
//       environment.head[(param.argument as es.Identifier).name] = array
//     } else {
//       environment.head[(param as es.Identifier).name] = args[index]
//     }
//   })
//   return environment
// }

export const createSimpleEnvironment = (
  context: PyContext,
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

export const createProgramEnvironment = (context: PyContext, isPrelude: boolean): Environment => {
  return createSimpleEnvironment(context, isPrelude ? 'prelude' : 'programEnvironment');
};

export const createBlockEnvironment = (
  context: PyContext,
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

// export const isRestElement = (node: Node): node is es.RestElement => {
//   return (node as es.RestElement).type === 'RestElement';
// };

// export const handleArrayCreation = (
//   context: PyContext,
//   array: any[],
//   envOverride?: Environment
// ): void => {
//   const environment = envOverride ?? currentEnvironment(context);
//   Object.defineProperties(array, {
//     id: { value: uniqueId(context) },
//     environment: { value: environment, writable: true }
//   });
//   environment.heap.add(array as any);
// };

export const currentEnvironment = (context: PyContext): Environment => {
  return context.runtime.environments[0];
};

export const popEnvironment = (context: PyContext) => context.runtime.environments.shift()

export const pushEnvironment = (context: PyContext, environment: Environment) => {
  context.runtime.environments.unshift(environment)
  context.runtime.environmentTree.insert(environment)
}
