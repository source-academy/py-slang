/**
 * This interpreter implements an explicit-control evaluator.
 *
 * Heavily adapted from https://github.com/source-academy/JSpike/
 */

/* tslint:disable:max-classes-per-file */

import { StmtNS, ExprNS } from '../ast-types'
import { PyClosure } from './py_closure'
import { PyContext } from './py_context'
import { PyControl, PyControlItem } from './py_control'
import {
  createEnvironment,
  currentEnvironment,
  pushEnvironment,
  popEnvironment
} from './py_environment'
import {
  PyNode,
  Instr,
  InstrType,
  UnOpInstr,
  BinOpInstr,
  BoolOpInstr,
  AssmtInstr,
  AppInstr,
  BranchInstr
} from './py_types'
import { Stash, Value, ErrorValue } from './stash'
import { IOptions } from '../runner/pyRunner'
import * as instrCreator from './py_instrCreator'
import {
  evaluateUnaryExpression,
  evaluateBinaryExpression,
  evaluateBoolExpression,
  isFalsy
} from './py_operators'
import { Result, Finished, CSEBreak, Representation } from '../types'
import { toPythonString } from '../py_stdlib'
import { pyGetVariable, pyDefineVariable, scanForAssignments } from './py_utils'

type CmdEvaluator = (
  code: string,
  command: PyControlItem,
  context: PyContext,
  control: PyControl,
  stash: Stash,
  isPrelude: boolean
) => void

let cseFinalPrint = ''
export function addPrint(str: string) {
  cseFinalPrint = cseFinalPrint + str + '\n'
}

/**
 * Function that returns the appropriate Promise<Result> given the output of CSE machine evaluating, depending
 * on whether the program is finished evaluating, ran into a breakpoint or ran into an error.
 * @param context The context of the program.
 * @param value The value of CSE machine evaluating the program.
 * @returns The corresponding promise.
 */
export function PyCSEResultPromise(context: PyContext, value: Value): Promise<Result> {
  return new Promise((resolve, reject) => {
    if (value instanceof CSEBreak) {
      resolve({ status: 'suspended-cse-eval', context })
    } else if (value.type === 'error') {
      const msg = value.message
      const representation = new Representation(cseFinalPrint + msg)
      resolve({ status: 'finished', context, value, representation })
    } else {
      const representation = new Representation(value)
      resolve({ status: 'finished', context, value, representation })
    }
  })
}

/**
 * Function to be called when a program is to be interpreted using
 * the explicit control evaluator.
 *
 * @param code For error message reference.
 * @param program The program to evaluate.
 * @param context The context to evaluate the program in.
 * @param options Evaluation options.
 * @returns The result of running the CSE machine.
 */

let source = ''

export function PyEvaluate(
  code: string,
  program: StmtNS.Stmt,
  context: PyContext,
  options: IOptions
): Value {
  source = code

  try {
    // TODO: is undefined variables check necessary for Python?
    // checkProgramForUndefinedVariables(program, context)
  } catch (error: any) {
    return { type: 'error', message: error.message }
  }

  try {
    context.runtime.isRunning = true
    context.control = new PyControl(program)
    context.stash = new Stash()

    const result = pyRunCSEMachine(
      code,
      context,
      context.control,
      context.stash,
      options.envSteps!,
      options.stepLimit!,
      options.isPrelude
    )
    return context.output ? { type: 'string', value: context.output } : result
  } catch (error: any) {
    return { type: 'error', message: error.message }
  } finally {
    context.runtime.isRunning = false
  }
}

/**
 * The primary runner/loop of the explicit control evaluator.
 *
 * @param code For error check reference.
 * @param context The context to evaluate the program in.
 * @param control Points to the current Control stack.
 * @param stash Points to the current Stash.
 * @param envSteps Number of environment steps to run.
 * @param stepLimit Maximum number of steps to execute.
 * @param isPrelude Whether the program is the prelude.
 * @returns The top value of the stash after execution.
 */
export function pyRunCSEMachine(
  code: string,
  context: PyContext,
  control: PyControl,
  stash: Stash,
  envSteps: number,
  stepLimit: number,
  isPrelude: boolean = false
): Value {
  const eceState = pyGenerateCSEMachineStateStream(
    code,
    context,
    control,
    stash,
    envSteps,
    stepLimit,
    isPrelude
  )

  // Execute the generator until it completes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const _ of eceState) {
  }

  // Return the value at the top of the storage as the result
  const result = stash.peek()
  return result !== undefined ? result : { type: 'undefined' }
}

/**
 * Generator function that yields the state of the CSE Machine at each step.
 *
 * @param code For error check reference.
 * @param context The context of the program.
 * @param control The control stack.
 * @param stash The stash storage.
 * @param envSteps Number of environment steps to run.
 * @param stepLimit Maximum number of steps to execute.
 * @param isPrelude Whether the program is the prelude.
 * @yields The current state of the stash, control stack, and step count.
 */
export function* pyGenerateCSEMachineStateStream(
  code: string,
  context: PyContext,
  control: PyControl,
  stash: Stash,
  envSteps: number,
  stepLimit: number,
  isPrelude: boolean = false
) {
  // steps: number of steps completed
  let steps = 0

  let command = control.peek()

  // Push first node to be evaluated into context.
  // The typeguard is there to guarantee that we are pushing a node (which should always be the case)
  if (command && !('instrType' in command)) {
    context.runtime.nodes.unshift(command)
  }

  while (command) {
    // Return to capture a snapshot of the control and stash after the target step count is reached
    // if (!isPrelude && steps === envSteps) {
    //   yield { stash, control, steps }
    //   return
    // }

    // Step limit reached, stop further evaluation
    // TODO: error
    if (!isPrelude && steps === stepLimit) {
      //   handleRuntimeError(context, new error.StepLimitExceededError(source, command as es.Node, context));
    }

    // TODO: until envChanging is implemented
    // if (!isPrelude && envChanging(command)) {
    //   // command is evaluated on the next step
    //   // Hence, next step will change the environment
    //   context.runtime.changepointSteps.push(steps + 1)
    // }

    control.pop()
    if (!('instrType' in command)) {
      // Command is an AST node
      const node = command as PyNode

      context.runtime.nodes.shift()
      context.runtime.nodes.unshift(node)

      const nodeType = node.constructor.name
      if (pyCmdEvaluators[nodeType]) {
        pyCmdEvaluators[nodeType](code, command, context, control, stash, isPrelude)
      } else {
        throw new Error(`Unknown Python AST node type: ${nodeType}`)
      }

      if (context.runtime.break && context.runtime.debuggerOn) {
        // TODO
        // We can put this under isNode since context.runtime.break
        // will only be updated after a debugger statement and so we will
        // run into a node immediately after.
        // With the new evaluator, we don't return a break
        // return new CSEBreak()
      }
    } else {
      // Command is an instruction
      const instr = command as Instr
      if (pyCmdEvaluators[instr.instrType]) {
        pyCmdEvaluators[instr.instrType](code, command, context, control, stash, isPrelude)
      } else {
        throw new Error(`Unknown instruction type: ${instr.instrType}`)
      }
    }

    command = control.peek()

    steps += 1
    if (!isPrelude) {
      context.runtime.envStepsTotal = steps
    }

    yield { stash, control, steps }
  }
}

const pyCmdEvaluators: { [type: string]: CmdEvaluator } = {
  /**
   * AST Node Handlers
   */

  FileInput: (code, command, context, control, stash, isPrelude) => {
    const fileInput = command as StmtNS.FileInput
    const statements = fileInput.statements.slice().reverse()
    control.push(...statements)
  },

  SimpleExpr: (code, command, context, control, stash, isPrelude) => {
    const simpleExpr = command as StmtNS.SimpleExpr
    control.push(simpleExpr.expression)
  },

  Literal: (code, command, context, control, stash, isPrelude) => {
    const literal = command as ExprNS.Literal
    if (typeof literal.value === 'number') {
      stash.push({ type: 'number', value: literal.value })
    } else if (typeof literal.value === 'boolean') {
      stash.push({ type: 'bool', value: literal.value })
    } else if (typeof literal.value === 'string') {
      stash.push({ type: 'string', value: literal.value })
    } else {
      stash.push({ type: 'undefined' })
    }
  },

  BigIntLiteral: (code, command, context, control, stash, isPrelude) => {
    const literal = command as ExprNS.BigIntLiteral
    stash.push({ type: 'bigint', value: BigInt(literal.value) })
  },

  Unary: (code, command, context, control, stash, isPrelude) => {
    const unary = command as ExprNS.Unary
    const op_instr = instrCreator.unOpInstr(unary.operator.type, unary)
    control.push(op_instr)
    control.push(unary.right)
  },

  Binary: (code, command, context, control, stash, isPrelude) => {
    const binary = command as ExprNS.Binary
    const op_instr = instrCreator.binOpInstr(binary.operator.type, binary)
    control.push(op_instr)
    control.push(binary.right)
    control.push(binary.left)
  },

  BoolOp: (code, command, context, control, stash, isPrelude) => {
    const boolOp = command as ExprNS.BoolOp
    control.push(instrCreator.boolOpInstr(boolOp.operator.type, boolOp))
    control.push(boolOp.right)
    control.push(boolOp.left)
  },

  Grouping: (code, command, context, control, stash, isPrelude) => {
    const groupingNode = command as ExprNS.Grouping
    control.push(groupingNode.expression)
  },

  Complex: (code, command, context, control, stash, isPrelude) => {
    const complexNode = command as ExprNS.Complex
    stash.push({ type: 'complex', value: complexNode.value })
  },

  None: (code, command, context, control, stash, isPrelude) => {
    stash.push({ type: 'undefined' })
  },

  Variable: (code, command, context, control, stash, isPrelude) => {
    const variableNode = command as ExprNS.Variable
    const name = variableNode.name.lexeme

    // if not built in, look up in environment
    const value = pyGetVariable(code, context, name, variableNode)
    stash.push(value)
  },

  Compare: (code, command, context, control, stash, isPrelude) => {
    const compareNode = command as ExprNS.Compare
    // For now, we only handle simple, single comparisons.
    const op_instr = instrCreator.binOpInstr(compareNode.operator.type, compareNode)
    control.push(op_instr)
    control.push(compareNode.right)
    control.push(compareNode.left)
  },

  Assign: (code, command, context, control, stash, isPrelude) => {
    const assignNode = command as StmtNS.Assign

    const assmtInstr = instrCreator.assmtInstr(assignNode.name.lexeme, false, true, assignNode)

    control.push(assmtInstr)
    control.push(assignNode.value)
  },

  Call: (code, command, context, control, stash, isPrelude) => {
    const callNode = command as ExprNS.Call

    // push application instruction, track number of arguments
    control.push(instrCreator.appInstr(callNode.args.length, callNode))

    // push arguments onto stacks in reverse order
    for (let i = callNode.args.length - 1; i >= 0; i--) {
      control.push(callNode.args[i])
    }

    // push function expression itself
    control.push(callNode.callee)
  },

  FunctionDef: (code, command, context, control, stash, isPrelude) => {
    const functionDefNode = command as StmtNS.FunctionDef

    // find all local variables defined in function body
    const localVariables = scanForAssignments(functionDefNode.body)
    // create closure, capture function code and environment
    const closure = PyClosure.makeFromFunctionDef(
      functionDefNode,
      currentEnvironment(context),
      context,
      localVariables
    )
    // define function name in current environment and bind to new closure
    pyDefineVariable(context, functionDefNode.name.lexeme, closure)
  },

  Lambda: (code, command, context, control, stash, isPrelude) => {
    const lambdaNode = command as ExprNS.Lambda

    // find all local variables defined in function body
    const localVariables = scanForAssignments(lambdaNode.body)
    //create closure, capturing current environment
    const closure = PyClosure.makeFromLambda(
      lambdaNode,
      currentEnvironment(context),
      context,
      localVariables
    )
    // lambda is expression, just push value onto stash
    stash.push(closure)
  },

  /**
   * Only handles explicit return for now
   * To handle implicit return None next
   */
  Return: (code, command, context, control, stash, isPrelude) => {
    const returnNode = command as StmtNS.Return

    let head

    while (true) {
      head = control.pop()

      // if stack is empty before RESET, break
      if (!head || ('instrType' in head && head.instrType === InstrType.RESET)) {
        break
      }
    }
    if (head) {
      control.push(head)
    }
    // explicit return
    if (returnNode.value) {
      control.push(returnNode.value)
    } else {
      // if just return, returns None like implicit return
      stash.push({ type: 'undefined' })
    }
  },

  If: (code, command, context, control, stash, isPrelude) => {
    const ifNode = command as StmtNS.If

    // create branch instruction, wrap statement arrays in 'StatementSequence' objects
    const branch = instrCreator.branchInstr(
      { type: 'StatementSequence', body: ifNode.body },
      ifNode.elseBlock
        ? Array.isArray(ifNode.elseBlock)
          ? // 'else' block
            { type: 'StatementSequence', body: ifNode.elseBlock }
          : // 'elif' block
            ifNode.elseBlock
        : // 'else' block dont exist
          null,
      ifNode
    )
    control.push(branch)
    control.push(ifNode.condition)
  },

  Ternary: (code, command, context, control, stash, isPrelude) => {
    const ternaryNode = command as ExprNS.Ternary
    const branch = instrCreator.branchInstr(
      ternaryNode.consequent,
      ternaryNode.alternative,
      ternaryNode
    )
    control.push(branch)
    control.push(ternaryNode.predicate)
  },

  FromImport: (code, command, context, control, stash, isPrelude) => {
    // TODO: nothing to do for now, we can implement it for CSE instructions later on
    // All modules are preloaded into the global environment by the runner.
    // When the code later uses the module name (e.g., 'runes'), pyGetVariable
    // will find it in the global scope.
  },

  /**
   * Instruction Handlers
   */
  [InstrType.UNARY_OP]: function (code, command, context, control, stash, isPrelude) {
    const instr = command as UnOpInstr
    const argument = stash.pop()
    if (argument) {
      const result = evaluateUnaryExpression(
        code,
        instr.srcNode as ExprNS.Expr,
        context,
        instr.symbol,
        argument
      )
      stash.push(result)
    }
  },

  [InstrType.BINARY_OP]: function (code, command, context, control, stash, isPrelude) {
    const instr = command as BinOpInstr
    const right = stash.pop()
    const left = stash.pop()
    if (left && right) {
      const result = evaluateBinaryExpression(
        code,
        instr.srcNode as ExprNS.Expr,
        context,
        instr.symbol,
        left,
        right
      )
      stash.push(result)
    }
  },

  [InstrType.BOOL_OP]: function (code, command, context, control, stash, isPrelude) {
    const instr = command as BoolOpInstr
    const right = stash.pop()
    const left = stash.pop()

    if (left && right) {
      const result = evaluateBoolExpression(
        code,
        instr.srcNode as ExprNS.Expr,
        context,
        instr.symbol,
        left,
        right
      )
      stash.push(result)
    }
  },

  [InstrType.ASSIGNMENT]: (code, command, context, control, stash, isPrelude) => {
    const instr = command as AssmtInstr
    // Get the evaluated value from the stash
    const value = stash.pop()

    if (value) {
      pyDefineVariable(context, instr.symbol, value)
    }
  },

  [InstrType.APPLICATION]: (code, command, context, control, stash, isPrelude) => {
    const instr = command as AppInstr
    const numOfArgs = instr.numOfArgs

    // pop evaluated arguments from stash
    const args = []
    for (let i = 0; i < numOfArgs; i++) {
      args.unshift(stash.pop())
    }

    // pop callable from stash
    const callable = stash.pop()

    if (callable instanceof PyClosure) {
      // User-defined function
      const closure = callable as PyClosure
      // push reset and implicit return for cleanup at end of function
      control.push(instrCreator.resetInstr(instr.srcNode))

      // Only push endOfFunctionBodyInstr for functionDef
      if (closure.node.constructor.name === 'FunctionDef') {
        control.push(instrCreator.endOfFunctionBodyInstr(instr.srcNode))
      }

      // create new function environment
      const newEnv = createEnvironment(context, closure, args, instr.srcNode as ExprNS.Call)
      pushEnvironment(context, newEnv)

      // push function body onto control stack
      const closureNode = closure.node
      if (closureNode.constructor.name === 'FunctionDef') {
        // 'def' has a body of statements
        const bodyStmts = (closureNode as StmtNS.FunctionDef).body.slice().reverse()
        control.push(...bodyStmts)
      } else {
        // 'lambda' has a body with a single expression
        const bodyExpr = (closureNode as ExprNS.Lambda).body
        control.push(bodyExpr)
      }
    } else {
      // Built-in function from stdlib / constants
      if (callable && callable.type === 'builtin') {
        const result = callable.func(context, ...args)
        stash.push(result)
      } else {
        // Fallback for any other callable types, though not expected
        const result = (callable as any)(context, ...args)
        stash.push(result)
      }
    }
  },

  [InstrType.RESET]: (code, command, context, control, stash, isPrelude) => {
    popEnvironment(context)
  },

  [InstrType.END_OF_FUNCTION_BODY]: (code, command, context, control, stash, isPrelude) => {
    // this is only reached if function runs to completion without explicit return
    stash.push({ type: 'undefined' })
  },

  [InstrType.BRANCH]: (code, command, context, control, stash, isPrelude) => {
    const instr = command as BranchInstr
    const condition = stash.pop()

    if (!isFalsy(condition)) {
      // Condition is truthy, execute the consequent
      const consequent = instr.consequent
      if (consequent && 'type' in consequent && consequent.type === 'StatementSequence') {
        control.push(...(consequent as any).body.slice().reverse())
      } else if (consequent) {
        // consequent of ternary or single statement
        control.push(consequent)
      }
    } else if (instr.alternate) {
      // Condition is falsy, execute the alternate
      const alternate = instr.alternate
      if (alternate && 'type' in alternate && alternate.type === 'StatementSequence') {
        // 'else' block
        control.push(...(alternate as any).body.slice().reverse())
      } else if (alternate) {
        // 'elif' or ternary alternative
        control.push(alternate)
      }
    }
    // If condition is falsy and there's no alternate, do nothing
  },

  [InstrType.POP]: (code, command, context, control, stash, isPrelude) => {
    stash.pop()
  }
}
