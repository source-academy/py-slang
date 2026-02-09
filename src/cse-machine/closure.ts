import { ExprNS, StmtNS } from '../ast-types';
import { Context } from './context';
import { ControlItem } from './control';
import { Environment, uniqueId } from './environment';
import { StatementSequence } from './types';
import { Value } from './stash';

export class JSValue {
  public readonly value: Value
  public readonly name: string

  constructor(value: Value, name: string) {
    this.value = value
    this.name = name
  }
}

/**
 * Represents a python closure, the class is a runtime representation of a function.
 * Bundles the function's code (AST node) with environment in which its defined.
 * When Closure is called, a new environment will be created whose parent is the 'Environment' captured
 */
export class Closure {
  public readonly id: string
  /** AST node for function, either a 'def' or 'lambda' */
  public node: StmtNS.FunctionDef | ExprNS.Lambda
  /** Environment captures at time of function's definition, key for lexical scoping */
  public environment: Environment
  public context: Context
  public readonly predefined: boolean
  public originalNode?: StmtNS.FunctionDef | ExprNS.Lambda
  /** Stores local variables for scope check */
  public localVariables: Set<string>

  constructor(
    node: StmtNS.FunctionDef | ExprNS.Lambda,
    environment: Environment,
    context: Context,
    predefined: boolean = false,
    localVariables: Set<string> = new Set()
  ) {
    this.id = uniqueId(context)
    this.node = node
    this.environment = environment
    this.context = context
    this.predefined = predefined
    this.originalNode = node
    this.localVariables = localVariables
  }

  /**
   * Creates closure for FunctionDef
   */
  static makeFromFunctionDef(
    node: StmtNS.FunctionDef,
    environment: Environment,
    context: Context,
    localVariables: Set<string>
  ): Closure {
    const closure = new Closure(node, environment, context, false, localVariables)
    return closure
  }

  /**
   * Creates closure for Lambda
   */
  static makeFromLambda(
    node: ExprNS.Lambda,
    environment: Environment,
    context: Context,
    localVariables: Set<string>
  ): Closure {
    const closure = new Closure(node, environment, context, false, localVariables)
    return closure
  }
}

/**
 * Type guard to check if a control item is a StatementSequence.
 */
export const isStatementSequence = (node: ControlItem): node is StatementSequence => {
  return (node as StatementSequence).type === 'StatementSequence'
}
