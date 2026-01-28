// Value.ts
import { ExprNS, StmtNS } from '../ast-types'
import { Closure } from './closure'
import { Environment } from './environment'
import { Stack } from './stack'
import { PyComplexNumber } from '../types'

/**
 * Value represents various runtime values in Python.
 */
export type Value = any
// | NumberValue
// | BoolValue
// | StringValue
// | ComplexValue
// | FunctionValue
// | LambdaValue
// | MultiLambdaValue
// | ErrorValue
// | UndefinedValue
// | BigIntValue
// | pyClosureValue
// | Builtin;

export interface pyClosureValue {
  type: 'closure'
  closure: Closure
}

export interface Builtin {
  type: 'builtin'
  name: string
  func: (...args: any[]) => any
}

export interface BigIntValue {
  type: 'bigint'
  value: bigint
}

export interface NumberValue {
  type: 'number'
  value: number
}

export interface BoolValue {
  type: 'bool'
  value: boolean
}

export interface StringValue {
  type: 'string'
  value: string
}

export interface ComplexValue {
  type: 'complex'
  value: PyComplexNumber
}

export interface FunctionValue {
  type: 'function'
  name: string
  params: string[]
  body: StmtNS.Stmt[]
  env: Environment
}

export interface LambdaValue {
  type: 'lambda'
  parameters: string[]
  body: ExprNS.Expr
  env: Environment
}

export interface MultiLambdaValue {
  type: 'multi_lambda'
  parameters: string[]
  body: StmtNS.Stmt[]
  varDecls: string[]
  env: Environment
}

export interface ErrorValue {
  type: 'error'
  message: string
}

// TODO: Merge undefined and None.
export interface UndefinedValue {
  type: 'undefined'
}

export class Stash extends Stack<Value> {
  public constructor() {
    super()
  }

  public copy(): Stash {
    const newStash = new Stash()
    const stackCopy = super.getStack()
    newStash.push(...stackCopy)
    return newStash
  }
}
