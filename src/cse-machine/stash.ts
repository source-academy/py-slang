// Value.ts
import { StmtNS } from "../ast-types";
import { PyComplexNumber } from "../types";
import { Closure } from "./closure";
import { Context } from "./context";
import { ControlItem } from "./control";
import { Environment } from "./environment";
import { Stack } from "./stack";

/**
 * Value represents various runtime values in Python.
 */
export type Value =
  | NumberValue
  | BuiltinValue
  | BoolValue
  | ComplexValue
  | StringValue
  | FunctionValue
  | MultiLambdaValue
  | ErrorValue
  | NoneValue
  | BigIntValue
  | ClosureValue
  | ListValue;

export interface ClosureValue {
  type: "closure";
  closure: Closure;
}

export interface ListValue {
  type: "list";
  value: Value[];
}

export interface BigIntValue {
  type: "bigint";
  value: bigint;
}

export interface ComplexValue {
  type: "complex";
  value: PyComplexNumber;
}

export interface NumberValue {
  type: "number";
  value: number;
}

export interface BoolValue {
  type: "bool";
  value: boolean;
}

export interface StringValue {
  type: "string";
  value: string;
}

export interface FunctionValue {
  type: "function";
  name: string;
  params: string[];
  body: StmtNS.Stmt[];
  env: Environment;
}

export interface MultiLambdaValue {
  type: "multi_lambda";
  parameters: string[];
  body: StmtNS.Stmt[];
  varDecls: string[];
  env: Environment;
}

export interface ErrorValue {
  type: "error";
  message: string;
}

export interface NoneValue {
  type: "none";
}

export interface BuiltinValue {
  type: "builtin";
  name: string;
  func: (args: Value[], code: string, command: ControlItem, context: Context) => Value;
}

export class Stash extends Stack<Value> {
  public constructor() {
    super();
  }

  public copy(): Stash {
    const newStash = new Stash();
    const stackCopy = super.getStack();
    newStash.push(...stackCopy);
    return newStash;
  }
}
