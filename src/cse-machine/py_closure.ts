import { StmtNS, ExprNS } from '../ast-types'
import { PyEnvironment, uniqueId } from './py_environment'
import { PyContext } from './py_context'
import { StatementSequence } from './py_types'
import { PyControlItem } from './py_control'

/**
 * Represents a python closure, the class is a runtime representation of a function.
 * Bundles the function's code (AST node) with environment in which its defined.
 * When Closure is called, a new environment will be created whose parent is the 'Environment' captured
 */
export class PyClosure {
  public readonly id: string
  /** AST node for function, either a 'def' or 'lambda' */
  public node: StmtNS.FunctionDef | ExprNS.Lambda;
  /** Environment captures at time of function's definition, key for lexical scoping */
  public environment: PyEnvironment;
  public context: PyContext;
  public readonly predefined: boolean;
  public originalNode?: StmtNS.FunctionDef | ExprNS.Lambda;

  constructor(
    node: StmtNS.FunctionDef | ExprNS.Lambda,
    environment: PyEnvironment,
    context: PyContext,
    predefined: boolean = false
) {
      this.id = uniqueId(context);
      this.node = node;
      this.environment = environment;
      this.context = context;
      this.predefined = predefined;
      this.originalNode = node;
  }

  /** 
   * Creates closure for FunctionDef
   */
  static makeFromFunctionDef (
    node: StmtNS.FunctionDef,
    environment: PyEnvironment,
    context: PyContext
  ): PyClosure {
    const closure = new PyClosure(node, environment, context);
    return closure;
  }

  /**
   * Creates closure for Lambda
   */
  static makeFromLambda(
       node: ExprNS.Lambda,
       environment: PyEnvironment,
       context: PyContext
     ): PyClosure {
       const closure = new PyClosure(node, environment, context);
       return closure;
     }
   }

/**
* Type guard to check if a control item is a StatementSequence.
*/
export const isStatementSequence = (node: PyControlItem): node is StatementSequence => {
  return (node as StatementSequence).type === 'StatementSequence';
};