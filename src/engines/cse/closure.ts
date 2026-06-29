import { ExprNS, StmtNS } from "../../ast-types";
import { Context } from "./context";
import { ControlItem } from "./control";
import { Environment, uniqueId } from "./environment";
import { StatementSequence } from "./types";
import { isNode } from "./utils";

/**
 * Represents a Python closure, the class is a runtime representation of a function.
 * Bundles the function's code (AST node) with environment in which its defined.
 * When Closure is called, a new environment will be created whose parent is the 'Environment' captured
 */
export class Closure {
  /** Unique ID defined for closure */
  public readonly id: string;
  /** AST node for function, either a 'def' or 'lambda' */
  public node: StmtNS.FunctionDef | ExprNS.Lambda;
  /** Environment captures at time of function's definition, key for lexical scoping */
  public environment: Environment;
  public context: Context;
  public readonly predefined: boolean;
  public originalNode?: StmtNS.FunctionDef | ExprNS.Lambda;
  /** Stores local variables for scope check */
  public localVariables: Set<string>;
  /** Stores variables declared global in this function body */
  public globalVariables: Set<string>;
  /** Stores variables declared nonlocal in this function body */
  public nonlocalVariables: Set<string>;

  constructor(
    node: StmtNS.FunctionDef | ExprNS.Lambda,
    environment: Environment,
    context: Context,
    predefined: boolean = false,
    localVariables: Set<string> = new Set(),
    globalVariables: Set<string> = new Set(),
    nonlocalVariables: Set<string> = new Set(),
  ) {
    this.id = uniqueId(context);
    this.node = node;
    this.environment = environment;
    this.context = context;
    this.predefined = predefined;
    this.originalNode = node;
    this.localVariables = localVariables;
    this.globalVariables = globalVariables;
    this.nonlocalVariables = nonlocalVariables;
  }

  static makeFromFunctionDef(
    node: StmtNS.FunctionDef,
    environment: Environment,
    context: Context,
    localVariables: Set<string>,
    globalVariables: Set<string> = new Set(),
    nonlocalVariables: Set<string> = new Set(),
  ): Closure {
    const closure = new Closure(node, environment, context, false, localVariables, globalVariables, nonlocalVariables);
    return closure;
  }

  static makeFromLambda(
    node: ExprNS.Lambda,
    environment: Environment,
    context: Context,
    localVariables: Set<string>,
  ): Closure {
    const closure = new Closure(node, environment, context, false, localVariables);
    return closure;
  }
}

export const isStatementSequence = (node: ControlItem): node is StatementSequence => {
  return isNode(node) && node.kind == "StatementSequence";
};
