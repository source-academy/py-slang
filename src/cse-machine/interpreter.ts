/**
 * This interpreter implements an explicit-control evaluator.
 *
 * Heavily adapted from https://github.com/source-academy/JSpike/
 */

/* tslint:disable:max-classes-per-file */

import { ExprNS, StmtNS } from '../ast-types';
import * as error from "../errors/errors";
import { BuiltinReassignmentError } from '../errors/errors';
import { IOptions } from '../runner/pyRunner';
import { builtIns, toPythonString } from '../stdlib';
import { CSEBreak, RecursivePartial, Representation, Result } from '../types';
import { Closure } from './closure';
import { Context } from './context';
import { Control, ControlItem } from './control';
import { createEnvironment, createProgramEnvironment, currentEnvironment, popEnvironment, pushEnvironment } from './environment';
import { handleRuntimeError } from './error';
import * as instrCreator from './instrCreator';
import { evaluateBinaryExpression, evaluateBoolExpression, evaluateUnaryExpression, isFalsy } from './operators';
import { Stash, Value } from './stash';
import { AppInstr, AssmtInstr, BinOpInstr, BoolOpInstr, BranchInstr, EnvInstr, Instr, InstrType, ListAccessInstr, ListInstr, Node, UnOpInstr } from './types';
import { envChanging, isNode, pyDefineVariable, pyGetVariable, scanForAssignments } from './utils';

type CmdEvaluator = (
  code: string,
  command: ControlItem,
  context: Context,
  control: Control,
  stash: Stash,
  isPrelude: boolean
) => void

let cseFinalPrint = "";
export function addPrint(str: string) {
  cseFinalPrint = cseFinalPrint + str + "\n";
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
      resolve({ status: 'suspended-cse-eval', context });
    } else if (value.type === 'error') {
      const msg = value.message;
      const representation = new Representation(cseFinalPrint + msg);
      resolve({ status: 'finished', context, value, representation })
    } else {
      const representation = new Representation(toPythonString(value));
      resolve({ status: 'finished', context, value, representation })
    }
  })
}

let source = "";

/**
 * Function to be called when a program is to be interpreted using
 * the explicit control evaluator.
 *
 * @param program The program to evaluate.
 * @param context The context to evaluate the program in.
 * @param options Evaluation options.
 * @returns The result of running the CSE machine.
 */
export async function evaluate(code: string, program: StmtNS.Stmt, context: Context, options: RecursivePartial<IOptions> = {}): Promise<Value> {
  source = code;
  try {
    // TODO: is undefined variables check necessary for Python?
    // checkProgramForUndefinedVariables(program, context)
  } catch (error: any) {
    return { type: 'error', message: error.message };
  }

  try {
    context.runtime.isRunning = true
    context.control = new Control(program);
    context.stash = new Stash();

    // Adaptation for new feature
    const result = runCSEMachine(
      code,
      context,
      context.control,
      context.stash,
      options.envSteps!,
      options.stepLimit!,
      options.isPrelude
    );
    return { type: "string", value: context.output };
  } catch (error: any) {
    return { type: 'error', message: error.message };
  } finally {
    context.runtime.isRunning = false;
  }
}

// function evaluateImports(program: StmtNS.Stmt, context: Context) {
//   try {
//     const [importNodeMap] = filterImportDeclarations(program)
//     const environment = currentEnvironment(context)
//     for (const [moduleName, nodes] of importNodeMap) {
//       const functions = context.nativeStorage.loadedModules[moduleName]
//       for (const node of nodes) {
//         for (const spec of node.specifiers) {
//           declareIdentifier(context, spec.local.name, node, environment)
//           let obj: any

//           switch (spec.type) {
//             case 'ImportSpecifier': {
//               if (spec.imported.type === 'Identifier') {
//                 obj = functions[spec.imported.name];
//               } else {
//                 throw new Error(`Unexpected literal import: ${spec.imported.value}`);
//               }
//               break
//             }
//             case 'ImportDefaultSpecifier': {
//               obj = functions.default
//               break
//             }
//             case 'ImportNamespaceSpecifier': {
//               obj = functions
//               break
//             }
//           }

//           defineVariable(context, spec.local.name, obj, true, node)
//         }
//       }
//     }
//   } catch (error) {
//     handleRuntimeError(context, error as RuntimeSourceError)
//   }
// }

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
export function runCSEMachine(
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
  );

  // Execute the generator until it completes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const value of eceState) {
  }

  // Return the value at the top of the storage as the result
  const result = stash.peek();
  return result !== undefined ? result : { type: 'none' };
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
      handleRuntimeError(context, new error.StepLimitExceededError(source, command as ExprNS.Expr, context));
    }

    if (!isPrelude && envChanging(command)) {
      // command is evaluated on the next step
      // Hence, next step will change the environment
      context.runtime.changepointSteps.push(steps + 1)
    }

    control.pop()
    if (isNode(command)) {
      const node = command as Node
      const nodeType = node.constructor.name

      context.runtime.nodes.shift()
      context.runtime.nodes.unshift(command)

      cmdEvaluators[nodeType](code, command, context, control, stash, isPrelude)

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
      cmdEvaluators[instr.instrType](code, command, context, control, stash, isPrelude)
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

  FileInput: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    const node = command as StmtNS.FileInput
    // Clean up non-global, non-program, and non-preparation environments
    while (
      currentEnvironment(context).name !== 'global' &&
      currentEnvironment(context).name !== 'programEnvironment' &&
      currentEnvironment(context).name !== 'prelude'
    ) {
      popEnvironment(context)
    }


    // if (hasDeclarations(command as es.BlockStatement) || hasImportDeclarations(command as es.BlockStatement)) {
    //   if (currentEnvironment(context).name != 'programEnvironment') {
    //     const programEnv = createProgramEnvironment(context, isPrelude)
    //     pushEnvironment(context, programEnv)
    //   }
    //   const environment = currentEnvironment(context)
    //   evaluateImports(command as unknown as es.Program, context)
    //   declareFunctionsAndVariables(context, command as es.BlockStatement, environment)
    // }

    if (node.statements.length > 0 && currentEnvironment(context).name !== 'programEnvironment') {
      const programEnv = createProgramEnvironment(context, isPrelude)
      pushEnvironment(context, programEnv)
    }
    // Push the block body as a sequence of statements onto the control stack
    const seq = node.statements.slice().reverse();
    control.push(...seq);

  },

  SimpleExpr: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    const simpleExpr = command as StmtNS.SimpleExpr
    control.push(simpleExpr.expression)
  },

  Literal: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    const literal = command as ExprNS.Literal
    if (typeof literal.value === 'number') {
      stash.push({ type: 'number', value: literal.value })
    } else if (typeof literal.value === 'boolean') {
      stash.push({ type: 'bool', value: literal.value })
    } else if (typeof literal.value === 'string') {
      stash.push({ type: 'string', value: literal.value })
    } else {
      stash.push({ type: 'none' })
    }
  },

  BigIntLiteral: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    const literal = command as ExprNS.BigIntLiteral
    stash.push({ type: 'bigint', value: BigInt(literal.value) })
  },

  Unary: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    const unary = command as ExprNS.Unary
    const op_instr = instrCreator.unOpInstr(unary.operator.type, unary)
    control.push(op_instr)
    control.push(unary.right)
  },

  Binary: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    const binary = command as ExprNS.Binary
    const op_instr = instrCreator.binOpInstr(binary.operator.type, binary)
    control.push(op_instr)
    control.push(binary.right)
    control.push(binary.left)
  },

  BoolOp: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    const boolOp = command as ExprNS.BoolOp
    control.push(instrCreator.boolOpInstr(boolOp.operator.type, boolOp))
    control.push(boolOp.right)
    control.push(boolOp.left)
  },

  Grouping: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    const groupingNode = command as ExprNS.Grouping
    control.push(groupingNode.expression)
  },

  Complex: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    const complexNode = command as ExprNS.Complex
    stash.push({ type: 'complex', value: complexNode.value })
  },

  None: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    stash.push({ type: 'none' })
  },

  Variable: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    const variableNode = command as ExprNS.Variable
    const name = variableNode.name.lexeme

    // if not built in, look up in environment
    const value = pyGetVariable(code, context, name, variableNode)
    stash.push(value)
  },

  Compare: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    const compareNode = command as ExprNS.Compare
    const op_instr = instrCreator.binOpInstr(compareNode.operator.type, compareNode)

    control.push(op_instr)
    control.push(compareNode.right)
    control.push(compareNode.left)
  },

  Assign: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    const assignNode = command as StmtNS.Assign
    const assmtInstr = instrCreator.assmtInstr(assignNode.name.lexeme, false, true, assignNode)

    control.push(assmtInstr)
    control.push(assignNode.value)
  },

  Call: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    const callNode = command as ExprNS.Call

    control.push(instrCreator.appInstr(callNode.args.length, callNode))
    for (let i = callNode.args.length - 1; i >= 0; i--) {
      control.push(callNode.args[i])
    }
    control.push(callNode.callee)
  },

  FunctionDef: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    const functionDefNode = command as StmtNS.FunctionDef
    const localVariables = scanForAssignments(functionDefNode.body)
    const closure = Closure.makeFromFunctionDef(
      functionDefNode,
      currentEnvironment(context),
      context,
      localVariables
    )
    pyDefineVariable(context, functionDefNode.name.lexeme, { type: 'closure', closure })
  },

  Lambda: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    const lambdaNode = command as ExprNS.Lambda
    const localVariables = scanForAssignments(lambdaNode.body)
    const closure = Closure.makeFromLambda(
      lambdaNode,
      currentEnvironment(context),
      context,
      localVariables
    )
    stash.push({ type: 'closure', closure })
  },

  Return: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    const returnNode = command as StmtNS.Return
    let head
    while (true) {
      head = control.pop()
      if (!head || ('instrType' in head && head.instrType === InstrType.RESET)) {
        break
      }
    }
    if (head) {
      control.push(head)
    }
    if (returnNode.value) {
      control.push(returnNode.value)
    } else {
      // implicit None return
      stash.push({ type: 'none' })
    }
  },


  If: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    const ifNode = command as StmtNS.If
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

  List: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    control.push(instrCreator.listInstr((command as ExprNS.List).elements.length, command as ExprNS.List))

    for (let i = (command as ExprNS.List).elements.length - 1; i >= 0; i--) {
      control.push((command as ExprNS.List).elements[i])
    }
  },

  Subscript: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    const subscriptNode = command as ExprNS.Subscript
    control.push(instrCreator.listAccessInstr(subscriptNode))
    control.push(subscriptNode.index)
    control.push(subscriptNode.value)
  },

  Ternary: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    const ternaryNode = command as ExprNS.Ternary
    const branch = instrCreator.branchInstr(
      ternaryNode.consequent,
      ternaryNode.alternative,
      ternaryNode
    )
    control.push(branch)
    control.push(ternaryNode.predicate)
  },

  FromImport: function (
  ) {
    // TODO: nothing to do for now, we can implement it for CSE instructions later on
    // All modules are preloaded into the global environment by the runner.
    // When the code later uses the module name (e.g., 'runes'), pyGetVariable
    // will find it in the global scope.
  },

  /**
   * Instructions
   */
  [InstrType.RESET]: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    popEnvironment(context)
  },

  [InstrType.ASSIGNMENT]: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    const instr = command as AssmtInstr
    const value = stash.pop()

    if (value) {
      if (builtIns.has(instr.symbol)) {
        throw new BuiltinReassignmentError(code, instr.symbol, instr.srcNode as ExprNS.Expr)
      }
      pyDefineVariable(context, instr.symbol, value)
    }
  },

  [InstrType.UNARY_OP]: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
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

  [InstrType.BINARY_OP]: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
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

  [InstrType.BOOL_OP]: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
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

  [InstrType.POP]: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    stash.pop();
  },

  [InstrType.LIST]: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    const instr = command as ListInstr
    const elements: Value[] = []
    for (let i = 0; i < instr.numOfElements; i++) {
      const element = stash.pop()
      if (element) {
        elements.unshift(element)
      }
    }
    stash.push({ type: 'list', value: elements })
  },


  [InstrType.APPLICATION]: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    const instr = command as AppInstr
    const numOfArgs = instr.numOfArgs

    const args: Value[] = []
    for (let i = 0; i < numOfArgs; i++) {
      const arg = stash.pop()
      if (arg) {
        args.unshift(arg)
      }
    }

    const callable = stash.pop()

    if (callable?.type == "closure") {
      const closure = callable.closure
      control.push(instrCreator.resetInstr(instr.srcNode))

      if (closure.node.constructor.name === 'FunctionDef') {
        control.push(instrCreator.endOfFunctionBodyInstr(instr.srcNode))
      }

      const newEnv = createEnvironment(context, closure, args, instr.srcNode as ExprNS.Call)
      pushEnvironment(context, newEnv)

      const closureNode = closure.node
      if (closureNode.constructor.name === 'FunctionDef') {
        const bodyStmts = (closureNode as StmtNS.FunctionDef).body.slice().reverse()
        control.push(...bodyStmts)
      } else {
        const bodyExpr = (closureNode as ExprNS.Lambda).body
        control.push(bodyExpr)
      }
    } else {
      if (callable && callable.type === 'builtin') {
        const result = callable.func(args, code, instr.srcNode, context)
        stash.push(result)
      } else {
        // Fallback for any other callable types, though not expected
        const result = (callable as any)(context, ...args)
        stash.push(result)
      }
    }
  },

  [InstrType.LIST_ACCESS]: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    const instr = command as ListAccessInstr
    const index = stash.pop()
    const list = stash.pop()
    console.log(index, list)
    if (!list || list.type !== 'list') {
      handleRuntimeError(context, new error.TypeError(code, instr.srcNode as ExprNS.Expr, context, (list as Value).type, 'list'))
    }
    if (!index || index.type !== 'bigint') {
      handleRuntimeError(context, new error.TypeError(code, instr.srcNode as ExprNS.Expr, context, (index as Value).type, 'int'))
    }
    const idx = Number(index.value)
    if (idx >= list.value.length) {
      handleRuntimeError(context, new error.IndexError(code, instr.srcNode as ExprNS.Expr, context, idx, list.value.length))
    }
    stash.push(list.value[idx])
  },

  [InstrType.BRANCH]: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    const instr = command as BranchInstr
    const condition = stash.pop()

    if (condition && !isFalsy(condition)) {
      const consequent = instr.consequent
      if (consequent && 'type' in consequent && consequent.type === 'StatementSequence') {
        control.push(...(consequent as any).body.slice().reverse())
      } else if (consequent) {
        control.push(consequent)
      }
    } else if (instr.alternate) {
      const alternate = instr.alternate
      if (alternate && 'type' in alternate && alternate.type === 'StatementSequence') {
        control.push(...(alternate as any).body.slice().reverse())
      } else if (alternate) {
        control.push(alternate)
      }
    }
  },

  [InstrType.ENVIRONMENT]: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    while (currentEnvironment(context).id !== (command as EnvInstr).env.id) {
      popEnvironment(context);
    }
  },

  [InstrType.END_OF_FUNCTION_BODY]: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    stash.push({ type: 'none' });
  }
};
