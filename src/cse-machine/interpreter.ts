/**
 * This interpreter implements an explicit-control evaluator.
 *
 * Heavily adapted from https://github.com/source-academy/JSpike/
 */

/* tslint:disable:max-classes-per-file */

import * as es from 'estree'
import { Stack } from './stack'
import { Control, ControlItem } from './control'
import { Stash, Value } from './stash'
import {
  Environment,
  createBlockEnvironment,
  createEnvironment,
  createProgramEnvironment,
  currentEnvironment,
  popEnvironment,
  pushEnvironment
} from './environment'
import { Context } from './context'
import {
  isNode,
  isBlockStatement,
  hasDeclarations,
  statementSequence,
  blockArrowFunction,
  constantDeclaration,
  pyVariableDeclaration,
  identifier,
  literal
} from './ast-helper'
import {
  envChanging,
  declareFunctionsAndVariables,
  handleSequence,
  defineVariable,
  getVariable,
  checkStackOverFlow,
  checkNumberOfArguments,
  isInstr,
  isSimpleFunction,
  isIdentifier,
  reduceConditional,
  valueProducing,
  handleRuntimeError,
  hasImportDeclarations,
  declareIdentifier,
  typeTranslator
} from './utils'
import {
  AppInstr,
  AssmtInstr,
  BinOpInstr,
  BranchInstr,
  EnvInstr,
  Instr,
  InstrType,
  StatementSequence,
  UnOpInstr
} from './types'
import * as instr from './instrCreator'
import { Closure } from './closure'
import { evaluateBinaryExpression, evaluateUnaryExpression } from './operators'
import { conditionalExpression } from './instrCreator'
import * as error from '../errors/errors'
import {
  ComplexLiteral,
  CSEBreak,
  None,
  PyComplexNumber,
  RecursivePartial,
  Representation,
  Result
} from '../types'
import { builtIns, builtInConstants } from '../stdlib'
import { IOptions } from '../runner/pyRunner'
import { CseError } from './error'
import { filterImportDeclarations } from './dict'
import { RuntimeSourceError } from '../errors/errors'

type CmdEvaluator = (
  command: ControlItem,
  context: Context,
  control: Control,
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
export function CSEResultPromise(context: Context, value: Value): Promise<Result> {
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

let source = ''

/**
 * Function to be called when a program is to be interpreted using
 * the explicit control evaluator.
 *
 * @param program The program to evaluate.
 * @param context The context to evaluate the program in.
 * @param options Evaluation options.
 * @returns The result of running the CSE machine.
 */
export function evaluate(
  code: string,
  program: es.Program,
  context: Context,
  options: RecursivePartial<IOptions> = {}
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
    context.control = new Control(program)
    context.stash = new Stash()
    // Adaptation for new feature
    const result = runCSEMachine(
      code,
      context,
      context.control,
      context.stash,
      options.envSteps!,
      options.stepLimit!,
      options.isPrelude
    )
    const rep: Value = { type: 'string', value: cseFinalPrint }
    return rep
  } catch (error: any) {
    return { type: 'error', message: error.message }
  } finally {
    context.runtime.isRunning = false
  }
}

function evaluateImports(program: es.Program, context: Context) {
  try {
    const [importNodeMap] = filterImportDeclarations(program)
    const environment = currentEnvironment(context)
    for (const [moduleName, nodes] of importNodeMap) {
      const functions = context.nativeStorage.loadedModules[moduleName]
      for (const node of nodes) {
        for (const spec of node.specifiers) {
          declareIdentifier(context, spec.local.name, node, environment)
          let obj: any

          switch (spec.type) {
            case 'ImportSpecifier': {
              if (spec.imported.type === 'Identifier') {
                obj = functions[spec.imported.name]
              } else {
                throw new Error(`Unexpected literal import: ${spec.imported.value}`)
              }
              break
            }
            case 'ImportDefaultSpecifier': {
              obj = functions.default
              break
            }
            case 'ImportNamespaceSpecifier': {
              obj = functions
              break
            }
          }

          defineVariable(context, spec.local.name, obj, true, node)
        }
      }
    }
  } catch (error) {
    handleRuntimeError(context, error as RuntimeSourceError)
  }
}

/**
 * The primary runner/loop of the explicit control evaluator.
 *
 * @param context The context to evaluate the program in.
 * @param control Points to the current Control stack.
 * @param stash Points to the current Stash.
 * @param envSteps Number of environment steps to run.
 * @param stepLimit Maximum number of steps to execute.
 * @param isPrelude Whether the program is the prelude.
 * @returns The top value of the stash after execution.
 */
function runCSEMachine(
  code: string,
  context: Context,
  control: Control,
  stash: Stash,
  envSteps: number,
  stepLimit: number,
  isPrelude: boolean = false
): Value {
  const eceState = generateCSEMachineStateStream(
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
  for (const value of eceState) {
  }

  // Return the value at the top of the storage as the result
  const result = stash.peek()
  return result !== undefined ? result : { type: 'undefined' }
}

/**
 * Generator function that yields the state of the CSE Machine at each step.
 *
 * @param context The context of the program.
 * @param control The control stack.
 * @param stash The stash storage.
 * @param envSteps Number of environment steps to run.
 * @param stepLimit Maximum number of steps to execute.
 * @param isPrelude Whether the program is the prelude.
 * @yields The current state of the stash, control stack, and step count.
 */
export function* generateCSEMachineStateStream(
  code: string,
  context: Context,
  control: Control,
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
  if (command && isNode(command)) {
    context.runtime.nodes.unshift(command)
  }

  while (command) {
    // Return to capture a snapshot of the control and stash after the target step count is reached
    // if (!isPrelude && steps === envSteps) {
    //   yield { stash, control, steps }
    //   return
    // }

    // Step limit reached, stop further evaluation
    if (!isPrelude && steps === stepLimit) {
      handleRuntimeError(
        context,
        new error.StepLimitExceededError(source, command as es.Node, context)
      )
    }

    if (!isPrelude && envChanging(command)) {
      // command is evaluated on the next step
      // Hence, next step will change the environment
      context.runtime.changepointSteps.push(steps + 1)
    }

    control.pop()
    if (isNode(command)) {
      context.runtime.nodes.shift()
      context.runtime.nodes.unshift(command)
      cmdEvaluators[command.type](command, context, control, stash, isPrelude)
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
      cmdEvaluators[(command as Instr).instrType](command, context, control, stash, isPrelude)
    }

    command = control.peek()

    steps += 1
    if (!isPrelude) {
      context.runtime.envStepsTotal = steps
    }

    yield { stash, control, steps }
  }
}

const cmdEvaluators: { [type: string]: CmdEvaluator } = {
  /**
   * AST Nodes
   */

  Program: function (
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    // Clean up non-global, non-program, and non-preparation environments
    while (
      currentEnvironment(context).name !== 'global' &&
      currentEnvironment(context).name !== 'programEnvironment' &&
      currentEnvironment(context).name !== 'prelude'
    ) {
      popEnvironment(context)
    }

    if (
      hasDeclarations(command as es.BlockStatement) ||
      hasImportDeclarations(command as es.BlockStatement)
    ) {
      if (currentEnvironment(context).name != 'programEnvironment') {
        const programEnv = createProgramEnvironment(context, isPrelude)
        pushEnvironment(context, programEnv)
      }
      const environment = currentEnvironment(context)
      evaluateImports(command as unknown as es.Program, context)
      declareFunctionsAndVariables(context, command as es.BlockStatement, environment)
    }

    if ((command as es.Program).body.length === 1) {
      // If the program contains only a single statement, execute it immediately
      const next = (command as es.Program).body[0]
      cmdEvaluators[next.type](next, context, control, stash, isPrelude)
    } else {
      // Push the block body as a sequence of statements onto the control stack
      const seq: StatementSequence = statementSequence(
        (command as es.Program).body as es.Statement[],
        (command as es.Program).loc
      ) as unknown as StatementSequence
      control.push(seq)
    }
  },

  BlockStatement: function (command: ControlItem, context: Context, control: Control) {
    const next = control.peek()

    // for some of the block statements, such as if, for,
    // no need to create a new environment

    if (!command.skipEnv) {
      // If environment instructions need to be pushed
      if (
        next &&
        !(isInstr(next) && next.instrType === InstrType.ENVIRONMENT) &&
        !control.canAvoidEnvInstr()
      ) {
        control.push(instr.envInstr(currentEnvironment(context), command as es.BlockStatement))
      }

      // create new block environment (for function)
      const environment = createBlockEnvironment(context, 'blockEnvironment')
      declareFunctionsAndVariables(context, command as es.BlockStatement, environment)
      pushEnvironment(context, environment)
    }

    // Push the block body onto the control stack as a sequence of statements
    const seq: StatementSequence = statementSequence(
      (command as es.BlockStatement).body,
      (command as es.BlockStatement).loc
    )
    control.push(seq)
  },

  StatementSequence: function (
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    if ((command as StatementSequence).body.length === 1) {
      // If the program contains only a single statement, execute it immediately
      const next = (command as StatementSequence).body[0]
      cmdEvaluators[next.type](next, context, control, stash, isPrelude)
    } else {
      // Split and push individual nodes
      control.push(...handleSequence((command as StatementSequence).body))
    }
  },

  IfStatement: function (command: ControlItem, context: Context, control: Control, stash: Stash) {
    control.push(...reduceConditional(command as es.IfStatement))
  },

  ExpressionStatement: function (
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    cmdEvaluators[(command as es.ExpressionStatement).expression.type](
      (command as es.ExpressionStatement).expression,
      context,
      control,
      stash,
      isPrelude
    )
  },

  VariableDeclaration: function (command: ControlItem, context: Context, control: Control) {
    const declaration: es.VariableDeclarator = (command as es.VariableDeclaration).declarations[0]
    const id = declaration.id as es.Identifier
    const init = declaration.init!

    control.push(instr.popInstr(command as es.VariableDeclaration))
    control.push(
      instr.assmtInstr(
        id.name,
        (command as es.VariableDeclaration).kind === 'const',
        true,
        command as es.VariableDeclaration
      )
    )
    control.push(init)
  },

  FunctionDeclaration: function (command: ControlItem, context: Context, control: Control) {
    const lambdaExpression: es.ArrowFunctionExpression = blockArrowFunction(
      (command as es.FunctionDeclaration).params as es.Identifier[],
      (command as es.FunctionDeclaration).body,
      (command as es.FunctionDeclaration).loc
    )
    const lambdaDeclaration: pyVariableDeclaration = constantDeclaration(
      (command as es.FunctionDeclaration).id!.name,
      lambdaExpression,
      (command as es.FunctionDeclaration).loc
    )
    control.push(lambdaDeclaration as ControlItem)
  },

  ReturnStatement: function (command: ControlItem, context: Context, control: Control) {
    const next = control.peek()
    if (next && isInstr(next) && next.instrType === InstrType.MARKER) {
      control.pop()
    } else {
      control.push(instr.resetInstr(command as es.ReturnStatement))
    }
    if ((command as es.ReturnStatement).argument) {
      control.push((command as es.ReturnStatement).argument!)
    }
  },

  ImportDeclaration: function () {},

  /**
   * Expressions
   */
  Literal: function (command: ControlItem, context: Context, control: Control, stash: Stash) {
    const literalValue = (command as es.Literal).value
    const bigintValue = (command as es.BigIntLiteral).bigint
    const complexValue = (command as unknown as ComplexLiteral).complex

    if (literalValue !== undefined) {
      let value: Value
      if (typeof literalValue === 'number') {
        value = { type: 'number', value: literalValue }
      } else if (typeof literalValue === 'string') {
        value = { type: 'string', value: literalValue }
      } else if (typeof literalValue === 'boolean') {
        value = { type: 'bool', value: literalValue }
      } else {
        //handleRuntimeError(context, new CseError('Unsupported literal type'));
        return
      }
      stash.push(value)
    } else if (bigintValue !== undefined) {
      let fixedBigintValue = bigintValue.toString().replace(/_/g, '')
      let value: Value
      try {
        value = { type: 'bigint', value: BigInt(fixedBigintValue) }
      } catch (e) {
        //handleRuntimeError(context, new CseError('Invalid BigInt literal'));
        return
      }
      stash.push(value)
    } else if (complexValue !== undefined) {
      let value: Value
      let pyComplexNumber = new PyComplexNumber(complexValue.real, complexValue.imag)
      try {
        value = { type: 'complex', value: pyComplexNumber }
      } catch (e) {
        //handleRuntimeError(context, new CseError('Invalid BigInt literal'));
        return
      }
      stash.push(value)
    } else {
      // TODO: handle errors
    }
  },

  NoneType: function (command: ControlItem, context: Context, control: Control, stash: Stash) {
    stash.push({ type: 'NoneType', value: undefined })
  },

  ConditionalExpression: function (
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    control.push(...reduceConditional(command as es.ConditionalExpression))
  },

  Identifier: function (command: ControlItem, context: Context, control: Control, stash: Stash) {
    if (builtInConstants.has((command as es.Identifier).name)) {
      const builtinCons = builtInConstants.get((command as es.Identifier).name)!
      stash.push(builtinCons)
    } else {
      stash.push(getVariable(context, (command as es.Identifier).name, command as es.Identifier))
    }
  },

  UnaryExpression: function (command: ControlItem, context: Context, control: Control) {
    control.push(
      instr.unOpInstr((command as es.UnaryExpression).operator, command as es.UnaryExpression)
    )
    control.push((command as es.UnaryExpression).argument)
  },

  BinaryExpression: function (command: ControlItem, context: Context, control: Control) {
    control.push(instr.binOpInstr((command as es.BinaryExpression).operator, command as es.Node))
    control.push((command as es.BinaryExpression).right)
    control.push((command as es.BinaryExpression).left)
  },

  LogicalExpression: function (command: ControlItem, context: Context, control: Control) {
    if ((command as es.LogicalExpression).operator === '&&') {
      control.push(
        conditionalExpression(
          (command as es.LogicalExpression).left,
          (command as es.LogicalExpression).right,
          literal(false),
          (command as es.LogicalExpression).loc
        )
      )
    } else {
      control.push(
        conditionalExpression(
          (command as es.LogicalExpression).left,
          literal(true),
          (command as es.LogicalExpression).right,
          (command as es.LogicalExpression).loc
        )
      )
    }
  },

  ArrowFunctionExpression: function (
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    const closure: Closure = Closure.makeFromArrowFunction(
      command as es.ArrowFunctionExpression,
      currentEnvironment(context),
      context,
      true,
      isPrelude
    )
    stash.push(closure)
  },

  CallExpression: function (command: ControlItem, context: Context, control: Control) {
    if (isIdentifier((command as es.CallExpression).callee)) {
      let name = ((command as es.CallExpression).callee as es.Identifier).name
      if (
        name === '__py_adder' ||
        name === '__py_minuser' ||
        name === '__py_multiplier' ||
        name === '__py_divider' ||
        name === '__py_modder' ||
        name === '__py_floorer' ||
        name === '__py_powerer'
      ) {
        control.push(
          instr.binOpInstr(
            (command as es.CallExpression).callee as es.Identifier,
            command as es.Node
          )
        )
        control.push((command as es.CallExpression).arguments[1])
        control.push((command as es.CallExpression).arguments[0])
        return
      }
    }

    control.push(
      instr.appInstr((command as es.CallExpression).arguments.length, command as es.CallExpression)
    )
    for (let index = (command as es.CallExpression).arguments.length - 1; index >= 0; index--) {
      control.push((command as es.CallExpression).arguments[index])
    }
    control.push((command as es.CallExpression).callee)
  },

  // /**
  //  * Instructions
  //  */
  [InstrType.RESET]: function (
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    const cmdNext: ControlItem | undefined = control.pop()
    if (cmdNext && (isNode(cmdNext) || (cmdNext as Instr).instrType !== InstrType.MARKER)) {
      control.push(instr.resetInstr((command as Instr).srcNode))
    }
  },

  [InstrType.ASSIGNMENT]: function (
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    if ((command as AssmtInstr).declaration) {
      //if ()
      defineVariable(
        context,
        (command as AssmtInstr).symbol,
        stash.peek()!,
        (command as AssmtInstr).constant,
        (command as AssmtInstr).srcNode as es.VariableDeclaration
      )
    } else {
      // second time definition
      // setVariable(
      //   context,
      //   command.symbol,
      //   stash.peek(),
      //   command.srcNode as es.AssignmentExpression
      // );
    }
  },

  [InstrType.UNARY_OP]: function (
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    const argument = stash.pop()
    stash.push(evaluateUnaryExpression((command as UnOpInstr).symbol, argument))
  },

  [InstrType.BINARY_OP]: function (
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    const right = stash.pop()
    const left = stash.pop()

    if (
      ((left.type === 'string' && right.type !== 'string') ||
        (left.type !== 'string' && right.type === 'string')) &&
      (command as BinOpInstr).symbol.name === '__py_adder'
    ) {
      const originalWrongType = left.type === 'string' ? right.type : left.type
      let wrongType = typeTranslator(originalWrongType)
      handleRuntimeError(
        context,
        new error.TypeConcatenateError(source, command as es.Node, wrongType)
      )
    }

    stash.push(
      evaluateBinaryExpression(
        source,
        command,
        context,
        (command as BinOpInstr).symbol,
        left,
        right
      )
    )
  },

  [InstrType.POP]: function (
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    stash.pop()
  },

  [InstrType.APPLICATION]: function (
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    checkStackOverFlow(context, control)
    const args: Value[] = []
    for (let index = 0; index < (command as AppInstr).numOfArgs; index++) {
      args.unshift(stash.pop()!)
    }

    const func: Closure = stash.pop()

    if (!(func instanceof Closure)) {
      // handleRuntimeError(context, new errors.CallingNonFunctionValue(func, command.srcNode))
    }

    if (func instanceof Closure) {
      // Check for number of arguments mismatch error
      checkNumberOfArguments(source, command, context, func, args, (command as AppInstr).srcNode)

      const next = control.peek()

      // Push ENVIRONMENT instruction if needed - if next control stack item
      // exists and is not an environment instruction, OR the control only contains
      // environment indepedent items
      if (
        next &&
        !(isInstr(next) && next.instrType === InstrType.ENVIRONMENT) &&
        !control.canAvoidEnvInstr()
      ) {
        control.push(instr.envInstr(currentEnvironment(context), (command as AppInstr).srcNode))
      }

      // Create environment for function parameters if the function isn't nullary.
      // Name the environment if the function call expression is not anonymous
      if (args.length > 0) {
        const environment = createEnvironment(
          context,
          func as Closure,
          args,
          (command as AppInstr).srcNode
        )
        pushEnvironment(context, environment)
      } else {
        context.runtime.environments.unshift((func as Closure).environment)
      }

      // Handle special case if function is simple
      if (isSimpleFunction((func as Closure).node)) {
        // Closures convert ArrowExpressionStatements to BlockStatements
        const block = (func as Closure).node.body as es.BlockStatement
        const returnStatement = block.body[0] as es.ReturnStatement
        control.push(returnStatement.argument ?? identifier('undefined', returnStatement.loc))
      } else {
        if (control.peek()) {
          // push marker if control not empty
          control.push(instr.markerInstr((command as AppInstr).srcNode))
        }
        control.push((func as Closure).node.body)
      }

      return
    }

    // Value is a built-in function
    let function_name = (
      ((command as AppInstr).srcNode as es.CallExpression).callee as es.Identifier
    ).name

    if (builtIns.has(function_name)) {
      const builtinFunc = builtIns.get(function_name)!

      stash.push(builtinFunc(args, source, command, context))
      return
    }
  },

  [InstrType.BRANCH]: function (
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    const test = stash.pop()

    if (test.value) {
      if (!valueProducing((command as BranchInstr).consequent)) {
        control.push(identifier('undefined', (command as BranchInstr).consequent.loc))
      }
      ;((command as BranchInstr).consequent as ControlItem).skipEnv = true
      control.push((command as BranchInstr).consequent)
    } else if ((command as BranchInstr).alternate) {
      if (!valueProducing((command as BranchInstr).alternate!)) {
        control.push(identifier('undefined', (command as BranchInstr).alternate!.loc))
      }
      ;((command as BranchInstr).alternate as ControlItem).skipEnv = true
      control.push((command as BranchInstr).alternate!)
    } else {
      control.push(identifier('undefined', (command as BranchInstr).srcNode.loc))
    }
  },

  [InstrType.ENVIRONMENT]: function (command: ControlItem, context: Context) {
    while (currentEnvironment(context).id !== (command as EnvInstr).env.id) {
      popEnvironment(context)
    }
  }
}
