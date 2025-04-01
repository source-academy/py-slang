import { ExprNS, StmtNS } from '../ast-types';
import { Token } from '../tokenizer';
import type * as es from 'estree';
import { Stack } from './stack';
import { isNode, isBlockStatement, hasDeclarations } from './ast-helper';
import { currentEnvironment, Environment } from './environment';
import { Control, ControlItem } from './control';
import {
    AppInstr,
    Instr,
    InstrType,
    BranchInstr,
    WhileInstr,
    ForInstr,
    Node,
    StatementSequence
} from './types'
import { Context } from './context'
import * as instr from './instrCreator'
import { Value } from './stash';
import { Closure } from './closure';
import { RuntimeSourceError } from '../errors/runtimeSourceError';
import { CseError } from './error';
import { MissingRequiredPositionalError, TooManyPositionalArgumentsError } from '../errors/errors';

export const isIdentifier = (node: Node): node is es.Identifier => {
  return (node as es.Identifier).name !== undefined
}

type PropertySetter = Map<string, Transformer>
type Transformer = (item: ControlItem) => ControlItem

const setToTrue = (item: ControlItem): ControlItem => {
  item.isEnvDependent = true
  return item
}

const setToFalse = (item: ControlItem): ControlItem => {
  item.isEnvDependent = false
  return item
}

const propertySetter: PropertySetter = new Map<string, Transformer>([
    // AST Nodes
    [
      'Program',
      (item: ControlItem) => {
        const node = item as Node & es.Program;
        node.isEnvDependent = node.body.some(elem => isEnvDependent(elem));
        return node;
      }
    ],
    ['Literal', setToFalse],
    ['ImportDeclaration', setToFalse],
    ['BreakStatement', setToFalse],
    ['ContinueStatement', setToFalse],
    ['DebuggerStatement', setToFalse],
    ['VariableDeclaration', setToTrue],
    ['FunctionDeclaration', setToTrue],
    ['ArrowFunctionExpression', setToTrue],
    ['Identifier', setToTrue],
    [
      'LogicalExpression',
      (item: ControlItem) => {
        const node = item as Node & es.LogicalExpression;
        node.isEnvDependent = isEnvDependent(node.left) || isEnvDependent(node.right);
        return node;
      }
    ],
    [
      'BinaryExpression',
      (item: ControlItem) => {
        const node = item as Node & es.BinaryExpression;
        node.isEnvDependent = isEnvDependent(node.left) || isEnvDependent(node.right);
        return node;
      }
    ],
    [
      'UnaryExpression',
      (item: ControlItem) => {
        const node = item as Node & es.UnaryExpression;
        node.isEnvDependent = isEnvDependent(node.argument);
        return node;
      }
    ],
    [
      'ConditionalExpression',
      (item: ControlItem) => {
        const node = item as Node & es.ConditionalExpression;
        node.isEnvDependent =
          isEnvDependent(node.consequent) ||
          isEnvDependent(node.alternate) ||
          isEnvDependent(node.test);
        return node;
      }
    ],
    [
      'MemberExpression',
      (item: ControlItem) => {
        const node = item as Node & es.MemberExpression;
        node.isEnvDependent = isEnvDependent(node.property) || isEnvDependent(node.object);
        return node;
      }
    ],
    [
      'ArrayExpression',
      (item: ControlItem) => {
        const node = item as Node & es.ArrayExpression;
        node.isEnvDependent = node.elements.some(elem => isEnvDependent(elem));
        return node;
      }
    ],
    [
      'AssignmentExpression',
      (item: ControlItem) => {
        const node = item as Node & es.AssignmentExpression;
        node.isEnvDependent = isEnvDependent(node.left) || isEnvDependent(node.right);
        return node;
      }
    ],
    [
      'ReturnStatement',
      (item: ControlItem) => {
        const node = item as Node & es.ReturnStatement;
        node.isEnvDependent = isEnvDependent(node.argument);
        return node;
      }
    ],
    [
      'CallExpression',
      (item: ControlItem) => {
        const node = item as Node & es.CallExpression;
        node.isEnvDependent =
          isEnvDependent(node.callee) || node.arguments.some(arg => isEnvDependent(arg));
        return node;
      }
    ],
    [
      'ExpressionStatement',
      (item: ControlItem) => {
        const node = item as Node & es.ExpressionStatement;
        node.isEnvDependent = isEnvDependent(node.expression);
        return node;
      }
    ],
    [
      'IfStatement',
      (item: ControlItem) => {
        const node = item as Node & es.IfStatement;
        node.isEnvDependent =
          isEnvDependent(node.test) ||
          isEnvDependent(node.consequent) ||
          isEnvDependent(node.alternate);
        return node;
      }
    ],
    [
      'ForStatement',
      (item: ControlItem) => {
        const node = item as Node & es.ForStatement;
        node.isEnvDependent =
          isEnvDependent(node.body) ||
          isEnvDependent(node.init) ||
          isEnvDependent(node.test) ||
          isEnvDependent(node.update);
        return node;
      }
    ],
    [
      'WhileStatement',
      (item: ControlItem) => {
        const node = item as Node & es.WhileStatement;
        node.isEnvDependent = isEnvDependent(node.body) || isEnvDependent(node.test);
        return node;
      }
    ],
    [
      'BlockStatement',
      (item: ControlItem) => {
        const node = item as Node & es.BlockStatement;
        node.isEnvDependent = node.body.some(stm => isEnvDependent(stm));
        return node;
      }
    ],
    [
      'StatementSequence',
      (item: ControlItem) => {
        const node = item as ControlItem & StatementSequence;
        node.isEnvDependent = node.body.some(stm => isEnvDependent(stm));
        return node;
      }
    ],
    ['ImportSpecifier', setToTrue],
    ['ImportDefaultSpecifier', setToTrue],
    
    // InstrType
    [InstrType.RESET, setToFalse],
    [InstrType.UNARY_OP, setToFalse],
    [InstrType.BINARY_OP, setToFalse],
    [InstrType.CONTINUE, setToFalse],
    [InstrType.ASSIGNMENT, setToTrue],
    [
      InstrType.WHILE,
      (item: ControlItem) => {
        const instr = item as WhileInstr;
        instr.isEnvDependent = isEnvDependent(instr.test) || isEnvDependent(instr.body);
        return instr;
      }
    ],
    [
      InstrType.FOR,
      (item: ControlItem) => {
        const instr = item as ForInstr;
        instr.isEnvDependent =
          isEnvDependent(instr.init) ||
          isEnvDependent(instr.test) ||
          isEnvDependent(instr.update) ||
          isEnvDependent(instr.body);
        return instr;
      }
    ],
    [
      InstrType.BRANCH,
      (item: ControlItem) => {
        const instr = item as BranchInstr;
        instr.isEnvDependent = isEnvDependent(instr.consequent) || isEnvDependent(instr.alternate);
        return instr;
      }
    ]
  ]);
  
  export { propertySetter };


/**
 * Checks whether the evaluation of the given control item depends on the current environment.
 * The item is also considered environment dependent if its evaluation introduces
 * environment dependent items
 * @param item The control item to be checked
 * @return `true` if the item is environment depedent, else `false`.
 */
export function isEnvDependent(item: ControlItem | null | undefined): boolean {
    if (item === null || item === undefined) {
      return false
    }
    // If result is already calculated, return it
    if (item.isEnvDependent !== undefined) {
      return item.isEnvDependent
    }
    let setter: Transformer | undefined;
    if (isNode(item)) {
      setter = propertySetter.get(item.type);
    } else if (isInstr(item)) {
      setter = propertySetter.get(item.instrType);
    }

    if (setter) {
      return setter(item)?.isEnvDependent ?? false
    }
  
    return false
}

// function isInstr(item: ControlItem): item is Instr & { isEnvDependent?: boolean } {
//   return (item as Instr).instrType !== undefined;
// }

// export const envChanging = (command: ControlItem): boolean => {
//   if (isNode(command)) {
//     const type = command.type
//     return (
//       type === 'Program' ||
//       type === 'BlockStatement' ||
//       type === 'ArrowFunctionExpression' ||
//       (type === 'ExpressionStatement' && command.expression.type === 'ArrowFunctionExpression')
//     )
//   } else {
//     const type = command.instrType
//     return (
//       type === InstrType.ENVIRONMENT ||
//       type === InstrType.ARRAY_LITERAL ||
//       type === InstrType.ASSIGNMENT ||
//       type === InstrType.ARRAY_ASSIGNMENT ||
//       (type === InstrType.APPLICATION && (command as AppInstr).numOfArgs > 0)
//     )
//   }
// }

export const envChanging = (command: ControlItem): boolean => {
  if (isNode(command)) {
    const type = command.type;
    return (
      type === 'Program' ||
      type === 'BlockStatement' ||
      type === 'ArrowFunctionExpression' ||
      (type === 'ExpressionStatement' && command.expression.type === 'ArrowFunctionExpression')
    );
  } else if (isInstr(command)) {
    const type = command.instrType;
    return (
      false
    );
  } else {
    return false;
  }
};

export function declareFunctionsAndVariables(
  context: Context,
  node: es.BlockStatement,
  environment: Environment
) {
  for (const statement of node.body) {
    switch (statement.type) {
      case 'VariableDeclaration':
        declareVariables(context, statement, environment)
        break
      case 'FunctionDeclaration':
        // FunctionDeclaration is always of type constant
        declareIdentifier(
          context,
          (statement.id as es.Identifier).name,
          statement,
          environment,
          true
        )
        break
    }
  }
}

function declareVariables(
  context: Context,
  node: es.VariableDeclaration,
  environment: Environment
) {
  for (const declaration of node.declarations) {
    // Retrieve declaration type from node
    const constant = node.kind === 'const'
    declareIdentifier(context, (declaration.id as es.Identifier).name, node, environment, constant)
  }
}

export function declareIdentifier(
  context: Context,
  name: string,
  node: Node,
  environment: Environment,
  constant: boolean = false
) {
  if (environment.head.hasOwnProperty(name)) {
    const descriptors = Object.getOwnPropertyDescriptors(environment.head)

    // return handleRuntimeError(
    //   context,
    //   new errors.VariableRedeclaration(node, name, descriptors[name].writable)
    // )
  }
  //environment.head[name] = constant ? UNASSIGNED_CONST : UNASSIGNED_LET
  environment.head[name] = 'declaration'
  
  return environment
}

export const handleSequence = (seq: es.Statement[]): ControlItem[] => {
  const result: ControlItem[] = []
  let valueProduced = false
  for (const command of seq) {
    //if (!isImportDeclaration(command)) {
      if (valueProducing(command)) {
        // Value producing statements have an extra pop instruction
        if (valueProduced) {
          result.push(instr.popInstr(command))
        } else {
          valueProduced = true
        }
      }
      result.push(command)
    //}
  }
  // Push statements in reverse order
  return result.reverse()
}

export const valueProducing = (command: Node): boolean => {
  const type = command.type
  return (
    type !== 'VariableDeclaration' &&
    type !== 'FunctionDeclaration' &&
    type !== 'ContinueStatement' &&
    type !== 'BreakStatement' &&
    type !== 'DebuggerStatement' &&
    (type !== 'BlockStatement' || command.body.some(valueProducing))
  )
}

export function defineVariable(
  context: Context,
  name: string,
  value: Value,
  constant = false,
  node: es.VariableDeclaration | es.ImportDeclaration
) {
  const environment = currentEnvironment(context)

  if (environment.head[name] !== 'declaration') {
    // error
    //return handleRuntimeError(context, new errors.VariableRedeclaration(node, name, !constant))
  }

  if (constant && value instanceof Closure) {
    value.declaredName = name;
  }

  Object.defineProperty(environment.head, name, {
    value,
    writable: !constant,
    enumerable: true
  })

  return environment
}

export const getVariable = (context: Context, name: string, node: es.Identifier) => {
  let environment: Environment | null = currentEnvironment(context)
  while (environment) {
    if (environment.head.hasOwnProperty(name)) {
      if (
        environment.head[name] === 'declaration'
      ) {
        //return handleRuntimeError(context, new errors.UnassignedVariable(name, node))
      } else {
        return environment.head[name]
      }
    } else {
      environment = environment.tail
    }
  }
  //return handleRuntimeError(context, new errors.UndefinedVariable(name, node))
}

export const checkStackOverFlow = (context: Context, control: Control) => {
  // todo
}

export const checkNumberOfArguments = (
  command: ControlItem,
  context: Context,
  callee: Closure | Value,
  args: Value[],
  exp: es.CallExpression
) => {
  if (callee instanceof Closure) {
    // User-defined or Pre-defined functions
    const params = callee.node.params
    // console.info("params: ", params);
    // console.info("args: ", args);
    //const hasVarArgs = params[params.length - 1]?.type === 'RestElement'

    if (params.length > args.length) {
      handleRuntimeError(context, new MissingRequiredPositionalError((command as es.Node), callee.declaredName!, params, args));
    } else if (params.length !== args.length) {
      handleRuntimeError(context, new TooManyPositionalArgumentsError((command as es.Node), callee.declaredName!, params, args));
    }
    //}

    // if (hasVarArgs ? params.length - 1 > args.length : params.length !== args.length) {
    //   // error
    //   // return handleRuntimeError(
    //   //   context,
    //   //   new errors.InvalidNumberOfArguments(
    //   //     exp,
    //   //     hasVarArgs ? params.length - 1 : params.length,
    //   //     args.length,
    //   //     hasVarArgs
    //   //   )
    //   // )
    // }
  } else {
    // Pre-built functions
    const hasVarArgs = callee.minArgsNeeded != undefined
    if (hasVarArgs ? callee.minArgsNeeded > args.length : callee.length !== args.length) {
      // error
      // return handleRuntimeError(
      //   context,
      //   new errors.InvalidNumberOfArguments(
      //     exp,
      //     hasVarArgs ? callee.minArgsNeeded : callee.length,
      //     args.length,
      //     hasVarArgs
      //   )
      // )
    }
  }
  return undefined
}

export const isInstr = (command: ControlItem): command is Instr => {
  return (command as Instr).instrType !== undefined
}

export const isSimpleFunction = (node: any) => {
  if (node.body.type !== 'BlockStatement' && node.body.type !== 'StatementSequence') {
    return true
  } else {
    const block = node.body
    return block.body.length === 1 && block.body[0].type === 'ReturnStatement'
  }
}

export const reduceConditional = (
  node: es.IfStatement | es.ConditionalExpression
): ControlItem[] => {
  return [instr.branchInstr(node.consequent, node.alternate, node), node.test]
}

export const handleRuntimeError = (context: Context, error: RuntimeSourceError) => {
  context.errors.push(error)

  console.error(error.explain());
  console.error(error.elaborate());
  //console.log("Location:", `Line ${e.location.start.line}, Column ${e.location.start.column}`);
  
  throw error;
}

export function pythonMod(a: any, b: any): any {
  const mod = a % b;
  if ((mod >= 0 && b > 0) || (mod <= 0 && b < 0)) {
    return mod;
  } else {
    return mod + b;
  }
}

export function hasImportDeclarations(node: es.BlockStatement): boolean {
  for (const statement of (node as unknown as es.Program).body) {
    if (statement.type === 'ImportDeclaration') {
      return true
    }
  }
  return false
}

export const isImportDeclaration = (
  node: es.Program['body'][number]
): node is es.ImportDeclaration => node.type === 'ImportDeclaration'

export function getModuleDeclarationSource(
  node: Exclude<es.ModuleDeclaration, es.ExportDefaultDeclaration>
): string {
  assert(
    typeof node.source?.value === 'string',
    `Expected ${node.type} to have a source value of type string, got ${node.source?.value}`
  )
  return node.source.value
}

export class AssertionError extends RuntimeSourceError {
  constructor(public readonly message: string) {
    super()
  }

  public explain(): string {
    return this.message
  }

  public elaborate(): string {
    return 'Please contact the administrators to let them know that this error has occurred'
  }
}

export default function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new AssertionError(message)
  }
}
