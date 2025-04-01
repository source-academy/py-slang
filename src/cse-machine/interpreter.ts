/**
 * This interpreter implements an explicit-control evaluator.
 *
 * Heavily adapted from https://github.com/source-academy/JSpike/
 */

/* tslint:disable:max-classes-per-file */

import * as es from 'estree'
import { Stack } from './stack'
import { Control, ControlItem } from './control';
import { Stash, Value } from './stash';
import { Environment, createBlockEnvironment, createEnvironment, createProgramEnvironment, currentEnvironment, popEnvironment, pushEnvironment } from './environment';
import { Context } from './context';
import { isNode, isBlockStatement, hasDeclarations, statementSequence, blockArrowFunction, constantDeclaration, pyVariableDeclaration, identifier, literal } from './ast-helper';
import { envChanging,declareFunctionsAndVariables, handleSequence, defineVariable, getVariable, checkStackOverFlow, checkNumberOfArguments, isInstr, isSimpleFunction, isIdentifier, reduceConditional, valueProducing, handleRuntimeError, hasImportDeclarations, declareIdentifier } from './utils';
import { AppInstr, AssmtInstr, BinOpInstr, BranchInstr, EnvInstr, Instr, InstrType, StatementSequence, UnOpInstr } from './types';
import * as instr from './instrCreator'
import { Closure } from './closure';
import { evaluateBinaryExpression, evaluateUnaryExpression } from './operators';
import { conditionalExpression } from './instrCreator';
import * as error from "../errors/errors"
import { ComplexLiteral, CSEBreak, None, PyComplexNumber, RecursivePartial, Representation, Result } from '../types';
import { builtIns, builtInConstants } from '../stdlib';
import { IOptions } from '..';
import { CseError } from './error';
import { filterImportDeclarations } from './dict';
import { RuntimeSourceError } from '../errors/runtimeSourceError';
import { Identifier } from '../conductor/types';

type CmdEvaluator = (
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
    } else if (value instanceof CseError) {
      resolve({ status: 'error' } as unknown as Result );
    } else {
      //const rep: Value = { type: "string", value: cseFinalPrint };
      const representation = new Representation(value);
      resolve({ status: 'finished', context, value, representation })
    }
  })
}

/**
 * Function to be called when a program is to be interpreted using
 * the explicit control evaluator.
 *
 * @param program The program to evaluate.
 * @param context The context to evaluate the program in.
 * @param options Evaluation options.
 * @returns The result of running the CSE machine.
 */
export function evaluate(program: es.Program, context: Context, options: RecursivePartial<IOptions> = {}): Value {
  try {
    // TODO: is undefined variables check necessary for Python?
    // checkProgramForUndefinedVariables(program, context)
  } catch (error: any) {
    context.errors.push(new CseError(error.message));
    return { type: 'error', message: error.message };
  }
  // TODO: should call transformer like in js-slang
  // seq.transform(program)

  try {
    context.runtime.isRunning = true
    context.control = new Control(program);
    context.stash = new Stash();
    // Adaptation for new feature
    const result = runCSEMachine(
      context,
      context.control,
      context.stash,
      options.envSteps!,
      options.stepLimit!,
      options.isPrelude
    );
    const rep: Value = { type: "string", value: cseFinalPrint };
    return rep;
  } catch (error: any) {
    context.errors.push(new CseError(error.message));
    return { type: 'error', message: error.message };
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
                obj = functions[spec.imported.name];
              } else {
                throw new Error(`Unexpected literal import: ${spec.imported.value}`);
              }
              //obj = functions[(spec.imported).name]
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
  context: Context,
  control: Control,
  stash: Stash,
  envSteps: number,
  stepLimit: number,
  isPrelude: boolean = false
): Value {
  const eceState = generateCSEMachineStateStream(
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
  return result !== undefined ? result : { type: 'undefined' };
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
    // For local debug only
    // console.info('next command to be evaluated');
    // console.info(command);

    // Return to capture a snapshot of the control and stash after the target step count is reached
    if (!isPrelude && steps === envSteps) {
      yield { stash, control, steps }
      return
    }
    // Step limit reached, stop further evaluation
    if (!isPrelude && steps === stepLimit) {
      break
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
      //checkEditorBreakpoints(context, command)
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

    // Push undefined into the stack if both control and stash is empty
    if (control.isEmpty() && stash.isEmpty()) {
      //stash.push(undefined)
    }
    command = control.peek()
    
    steps += 1
    if (!isPrelude) {
      context.runtime.envStepsTotal = steps
    }

    // printEnvironmentVariables(context.runtime.environments);

    yield { stash, control, steps }
  }
}

function printEnvironmentVariables(environments: Environment[]): void {
  console.info('----------------------------------------');
  environments.forEach(env => {
    console.info(`Env: ${env.name} (ID: ${env.id})`);
    
    const variables = env.head;
    const variableNames = Object.keys(variables);
    
    if (variableNames.length > 0) {
      variableNames.forEach(varName => {
        const descriptor = Object.getOwnPropertyDescriptor(env.head, varName);
        if (descriptor) {
          const value = descriptor.value.value;
          console.info('value: ', value);
          const valueStr = (typeof value === 'object' && value !== null) 
            ? JSON.stringify(value, null, 2) 
            : String(value);
          console.info(`  ${varName}: ${valueStr}`);
        } else {
          console.info(`  ${varName}: None`);
        }
      });
    } else {
      console.info('  no defined variables');
    }
  });
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

    if (hasDeclarations(command as es.BlockStatement) || hasImportDeclarations(command as es.BlockStatement)) {
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
      const next = (command as es.Program).body[0];
      cmdEvaluators[next.type](next, context, control, stash, isPrelude);
    } else {
      // Push the block body as a sequence of statements onto the control stack
      const seq: StatementSequence = statementSequence(
        (command as es.Program).body as es.Statement[],
        (command as es.Program).loc
      ) as unknown as StatementSequence
      control.push(seq);
    }
  },

  BlockStatement: function (
    command: ControlItem,
    context: Context,
    control: Control
  ) {
    const next = control.peek();

    // for some of the block statements, such as if, for,
    // no need to create a new environment

    if(!command.skipEnv){
      // If environment instructions need to be pushed
      if (
        next &&
        !(isInstr(next) && next.instrType === InstrType.ENVIRONMENT) &&
        !control.canAvoidEnvInstr()
      ) {
        control.push(instr.envInstr(currentEnvironment(context), command as es.BlockStatement));
      }

      // create new block environment (for function)
      const environment = createBlockEnvironment(context, 'blockEnvironment');
      declareFunctionsAndVariables(context, command as es.BlockStatement, environment);
      pushEnvironment(context, environment);
    }

    // Push the block body onto the control stack as a sequence of statements
    const seq: StatementSequence = statementSequence((command as es.BlockStatement).body, (command as es.BlockStatement).loc);
    control.push(seq);
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
      const next = (command as StatementSequence).body[0];
      cmdEvaluators[next.type](next, context, control, stash, isPrelude);
    } else {
      // Split and push individual nodes
      control.push(...handleSequence((command as StatementSequence).body));
    }
  },

  // WhileStatement: function (
  //   command: es.WhileStatement,
  //   context: Context,
  //   control: Control,
  //   stash: Stash
  // ) {
  //   if (hasBreakStatement(command.body as es.BlockStatement)) {
  //     control.push(instr.breakMarkerInstr(command));
  //   }
  //   control.push(instr.whileInstr(command.test, command.body, command));
  //   control.push(command.test);
  //   control.push(ast.identifier('undefined', command.loc)); // 如果没有循环执行，返回 undefined
  // },

  // ForStatement: function (
  //   command: es.ForStatement,
  //   context: Context,
  //   control: Control
  // ) {
  //   const init = command.init!;
  //   const test = command.test!;
  //   const update = command.update!;

  //   if (init.type === 'VariableDeclaration' && init.kind === 'let') {
  //     const id = init.declarations[0].id as es.Identifier;
  //     const valueExpression = init.declarations[0].init!;

  //     control.push(
  //       ast.blockStatement(
  //         [
  //           init,
  //           ast.forStatement(
  //             ast.assignmentExpression(id, valueExpression, command.loc),
  //             test,
  //             update,
  //             ast.blockStatement(
  //               [
  //                 ast.variableDeclaration(
  //                   [
  //                     ast.variableDeclarator(
  //                       ast.identifier(`_copy_of_${id.name}`, command.loc),
  //                       ast.identifier(id.name, command.loc),
  //                       command.loc
  //                     )
  //                   ],
  //                   command.loc
  //                 ),
  //                 ast.blockStatement(
  //                   [
  //                     ast.variableDeclaration(
  //                       [
  //                         ast.variableDeclarator(
  //                           ast.identifier(id.name, command.loc),
  //                           ast.identifier(`_copy_of_${id.name}`, command.loc),
  //                           command.loc
  //                         )
  //                       ],
  //                       command.loc
  //                     ),
  //                     command.body
  //                   ],
  //                   command.loc
  //                 )
  //               ],
  //               command.loc
  //             ),
  //             command.loc
  //           )
  //         ],
  //         command.loc
  //       )
  //     );
  //   } else {
  //     if (hasBreakStatement(command.body as es.BlockStatement)) {
  //       control.push(instr.breakMarkerInstr(command));
  //     }
  //     control.push(instr.forInstr(init, test, update, command.body, command));
  //     control.push(test);
  //     control.push(instr.popInstr(command)); // Pop value from init assignment
  //     control.push(init);
  //     control.push(ast.identifier('undefined', command.loc)); // Return undefined if there is no loop execution
  //   }
  // },

  IfStatement: function (
    command: ControlItem, //es.IfStatement,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    control.push(...reduceConditional(command as es.IfStatement));
  },

  ExpressionStatement: function (
    command: ControlItem,//es.ExpressionStatement,
    context: Context,
    control: Control,
    stash: Stash,
    isPrelude: boolean
  ) {
    cmdEvaluators[(command as es.ExpressionStatement).expression.type]((command as es.ExpressionStatement).expression, context, control, stash, isPrelude);
  },

  // DebuggerStatement: function (
  //   command: es.DebuggerStatement,
  //   context: Context
  // ) {
  //   context.runtime.break = true;
  // },

  VariableDeclaration: function (
    command: ControlItem,
    context: Context,
    control: Control
  ) {
    const declaration: es.VariableDeclarator = (command as es.VariableDeclaration).declarations[0];
    const id = declaration.id as es.Identifier;
    const init = declaration.init!;

    control.push(instr.popInstr(command as es.VariableDeclaration));
    control.push(instr.assmtInstr(id.name, (command as es.VariableDeclaration).kind === 'const', true, command as es.VariableDeclaration));
    control.push(init);
  },

  FunctionDeclaration: function (
    command: ControlItem, //es.FunctionDeclaration,
    context: Context,
    control: Control
  ) {
    const lambdaExpression: es.ArrowFunctionExpression = blockArrowFunction(
      (command as es.FunctionDeclaration).params as es.Identifier[],
      (command as es.FunctionDeclaration).body,
      (command as es.FunctionDeclaration).loc
    );
    const lambdaDeclaration: pyVariableDeclaration = constantDeclaration(
      (command as es.FunctionDeclaration).id!.name,
      lambdaExpression,
      (command as es.FunctionDeclaration).loc
    );
    control.push(lambdaDeclaration as ControlItem);
  },

  ReturnStatement: function (
    command: ControlItem, //as es.ReturnStatement,
    context: Context,
    control: Control
  ) {
    const next = control.peek();
    if (next && isInstr(next) && next.instrType === InstrType.MARKER) {
      control.pop();
    } else {
      control.push(instr.resetInstr(command as es.ReturnStatement));
    }
    if ((command as es.ReturnStatement).argument) {
      control.push((command as es.ReturnStatement).argument!);
    }
  },

  // ContinueStatement: function (
  //   command: es.ContinueStatement,
  //   context: Context,
  //   control: Control,
  //   stash: Stash
  // ) {
  //   control.push(instr.contInstr(command));
  // },

  // BreakStatement: function (
  //   command: es.BreakStatement,
  //   context: Context,
  //   control: Control,
  //   stash: Stash
  // ) {
  //   control.push(instr.breakInstr(command));
  // },

  ImportDeclaration: function () {},

  /**
   * Expressions
   */

  Literal: function (
    command: ControlItem, //es.Literal
    context: Context,
    control: Control,
    stash: Stash
  ) {
      const literalValue = (command as es.Literal).value;
      const bigintValue = (command as es.BigIntLiteral).bigint;
      const complexValue = ((command as unknown) as ComplexLiteral).complex;

      if (literalValue !== undefined) {
        let value: Value;
        if (typeof literalValue === 'number') {
          value = { type: 'number', value: literalValue };
        } else if (typeof literalValue === 'string') {
          value = { type: 'string', value: literalValue };
        } else if (typeof literalValue === 'boolean') {
          value = { type: 'bool', value: literalValue };
          //value = literalValue;
        } else {
          //handleRuntimeError(context, new CseError('Unsupported literal type'));
          return;
        }
        stash.push(value);
      } else if (bigintValue !== undefined) {
        let fixedBigintValue = bigintValue.toString().replace(/_/g, "");
        let value: Value;
        try {
          value = { type: 'bigint', value: BigInt(fixedBigintValue) };
        } catch (e) {
          //handleRuntimeError(context, new CseError('Invalid BigInt literal'));
          return;
        }
        stash.push(value);
      } else if (complexValue !== undefined) {
        let value: Value;
        let pyComplexNumber = new PyComplexNumber(complexValue.real, complexValue.imag);
        try {
          value = { type: 'complex', value: pyComplexNumber };
        } catch (e) {
          //handleRuntimeError(context, new CseError('Invalid BigInt literal'));
          return;
        }
        stash.push(value);
      } else {
        // TODO
        // Error
      }
    
  },

  NoneType: function (
    command: ControlItem, //es.Literal
    context: Context,
    control: Control,
    stash: Stash
  ) {
      stash.push({ type: 'NoneType', value: undefined });
  },

  // AssignmentExpression: function (
  //   command: es.AssignmentExpression,
  //   context: Context,
  //   control: Control
  // ) {
  //   if (command.left.type === 'MemberExpression') {
  //     control.push(instr.arrAssmtInstr(command));
  //     control.push(command.right);
  //     control.push(command.left.property);
  //     control.push(command.left.object);
  //   } else if (command.left.type === 'Identifier') {
  //     const id = command.left;
  //     control.push(instr.assmtInstr(id.name, false, false, command));
  //     control.push(command.right);
  //   }
  // },

  // ArrayExpression: function (
  //   command: es.ArrayExpression,
  //   context: Context,
  //   control: Control
  // ) {
  //   const elems = command.elements as es.Expression[];
  //   reverse(elems);
  //   const len = elems.length;

  //   control.push(instr.arrLitInstr(len, command));
  //   for (const elem of elems) {
  //     control.push(elem);
  //   }
  // },

  // MemberExpression: function (
  //   command: es.MemberExpression,
  //   context: Context,
  //   control: Control,
  //   stash: Stash
  // ) {
  //   control.push(instr.arrAccInstr(command));
  //   control.push(command.property);
  //   control.push(command.object);
  // },

  ConditionalExpression: function (
    command: ControlItem, //es.ConditionalExpression,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    control.push(...reduceConditional(command as es.ConditionalExpression));
  },

  Identifier: function (
    command: ControlItem,//es.Identifier,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    if (builtInConstants.has((command as es.Identifier).name)) {
      const builtinCons = builtInConstants.get((command as es.Identifier).name)!;
      try {
        stash.push(builtinCons);
        return;
      } catch (error) {
        // Error
        if (error instanceof Error) {
          throw new Error(error.message);
        } else {
          throw new Error();
        }
        // if (error instanceof RuntimeSourceError) {
        //   throw error;
        // } else {
        //   throw new RuntimeSourceError(`Error in builtin function ${funcName}: ${error}`);
        // }
      }
    } else {
      stash.push(getVariable(context, (command as es.Identifier).name, (command as es.Identifier)));
    }
  },

  UnaryExpression: function (
    command: ControlItem, //es.UnaryExpression,
    context: Context,
    control: Control
  ) {
    control.push(instr.unOpInstr((command as es.UnaryExpression).operator, command as es.UnaryExpression));
    control.push((command as es.UnaryExpression).argument);
  },

  BinaryExpression: function (
    command: ControlItem, //es.BinaryExpression,
    context: Context,
    control: Control
  ) {
    // currently for if statement

    control.push(instr.binOpInstr((command as es.BinaryExpression).operator, command as es.Node));
    control.push((command as es.BinaryExpression).right);
    control.push((command as es.BinaryExpression).left);
  },

  LogicalExpression: function (
    command: ControlItem, //es.LogicalExpression,
    context: Context,
    control: Control
  ) {
    if ((command as es.LogicalExpression).operator === '&&') {
      control.push(
        conditionalExpression((command as es.LogicalExpression).left, (command as es.LogicalExpression).right, literal(false), (command as es.LogicalExpression).loc)
      );
    } else {
      control.push(
        conditionalExpression((command as es.LogicalExpression).left, literal(true), (command as es.LogicalExpression).right, (command as es.LogicalExpression).loc)
      );
    }
  },

  ArrowFunctionExpression: function (
    command: ControlItem,//es.ArrowFunctionExpression,
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
    );
    stash.push(closure);
  },

  CallExpression: function (
    command: ControlItem,//es.CallExpression,
    context: Context,
    control: Control
  ) {
    // add
    if (isIdentifier((command as es.CallExpression).callee)) {
      let name = ((command as es.CallExpression).callee as es.Identifier).name;
      if (name === '__py_adder' || name === '__py_minuser' || 
          name === '__py_multiplier' || name === '__py_divider' || 
          name === '__py_modder' || name === '__py_floorer' || 
          name === '__py_powerer') {
        control.push(instr.binOpInstr((command as es.CallExpression).callee as es.Identifier, command as es.Node))
        control.push((command as es.CallExpression).arguments[1])
        control.push((command as es.CallExpression).arguments[0])
        return;
      }
    }

    control.push(instr.appInstr((command as es.CallExpression).arguments.length, command as es.CallExpression));
    for (let index = (command as es.CallExpression).arguments.length - 1; index >= 0; index--) {
      control.push((command as es.CallExpression).arguments[index]);
    }
    control.push((command as es.CallExpression).callee);
  },

  // /**
  //  * Instructions
  //  */

  [InstrType.RESET]: function (
    command: ControlItem, //Instr,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    const cmdNext: ControlItem | undefined = control.pop();
    if (cmdNext && (isNode(cmdNext) || (cmdNext as Instr).instrType !== InstrType.MARKER)) {
      control.push(instr.resetInstr((command as Instr).srcNode));
    }
  },

  // [InstrType.WHILE]: function (
  //   command: WhileInstr,
  //   context: Context,
  //   control: Control,
  //   stash: Stash
  // ) {
  //   const test = stash.pop();

  //   const error = rttc.checkIfStatement(command.srcNode, test, context.chapter);
  //   if (error) {
  //     handleRuntimeError(context, error);
  //   }

  //   if (test) {
  //     control.push(command);
  //     control.push(command.test);
  //     if (hasContinueStatement(command.body as es.BlockStatement)) {
  //       control.push(instr.contMarkerInstr(command.srcNode));
  //     }
  //     if (!valueProducing(command.body)) {
  //       control.push(ast.identifier('undefined', command.body.loc));
  //     }
  //     control.push(command.body);
  //     control.push(instr.popInstr(command.srcNode)); // Pop previous body value
  //   }
  // },

  // [InstrType.FOR]: function (
  //   command: ForInstr,
  //   context: Context,
  //   control: Control,
  //   stash: Stash
  // ) {
  //   const test = stash.pop();

  //   const error = rttc.checkIfStatement(command.srcNode, test, context.chapter);
  //   if (error) {
  //     handleRuntimeError(context, error);
  //   }

  //   if (test) {
  //     control.push(command);
  //     control.push(command.test);
  //     control.push(instr.popInstr(command.srcNode)); // Pop value from update
  //     control.push(command.update);
  //     if (hasContinueStatement(command.body as es.BlockStatement)) {
  //       control.push(instr.contMarkerInstr(command.srcNode));
  //     }
  //     if (!valueProducing(command.body)) {
  //       control.push(ast.identifier('undefined', command.body.loc));
  //     }
  //     control.push(command.body);
  //     control.push(instr.popInstr(command.srcNode)); // Pop previous body value
  //   }
  // },

  [InstrType.ASSIGNMENT]: function (
    command: ControlItem, //AssmtInstr,
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
      );
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
    command: ControlItem, //UnOpInstr,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    const argument = stash.pop();
    // const error = rttc.checkUnaryExpression(
    //   command.srcNode,
    //   command.symbol as es.UnaryOperator,
    //   argument,
    //   context.chapter
    // );
    // if (error) {
    //   handleRuntimeError(context, error);
    // }
    stash.push(evaluateUnaryExpression((command as UnOpInstr).symbol, argument));
  },

  [InstrType.BINARY_OP]: function (
    command: ControlItem, //BinOpInstr,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    const right = stash.pop();
    const left = stash.pop();
    // const error = rttc.checkBinaryExpression(
    //   command.srcNode,
    //   command.symbol as es.BinaryOperator,
    //   context.chapter,
    //   left,
    //   right
    // );
    // if (error) {
    //   handleRuntimeError(context, error);
    // }

    if ((left.type === 'string' && right.type !== 'string') || 
        (left.type !== 'string' && right.type === 'string')){
      handleRuntimeError(context, new error.TypeConcatenateError(command as es.Node));
    }
  

    stash.push(evaluateBinaryExpression(context, (command as BinOpInstr).symbol, left, right));
  
  },

  [InstrType.POP]: function (
    command: ControlItem,//Instr,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    stash.pop();
  },

  [InstrType.APPLICATION]: function (
    command: ControlItem, //AppInstr,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    checkStackOverFlow(context, control);
    const args: Value[] = [];
    for (let index = 0; index < (command as AppInstr).numOfArgs; index++) {
      args.unshift(stash.pop()!);
    }

    const func: Closure = stash.pop();

    if (!(func instanceof Closure)) {
      //error
      //handleRuntimeError(context, new errors.CallingNonFunctionValue(func, command.srcNode))
    }
    
    // continuation in python?

    // func instanceof Closure
    if (func instanceof Closure) {
      // Check for number of arguments mismatch error
      checkNumberOfArguments(command, context, func, args, (command as AppInstr).srcNode)

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
        const environment = createEnvironment(context, (func as Closure), args, (command as AppInstr).srcNode)
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

        // console.info((func as Closure).node.body);
      }

      return
    }

    // Value is a built-in function
    let function_name = (((command as AppInstr).srcNode as es.CallExpression).callee as es.Identifier).name;

    if (builtIns.has(function_name)) {
      const builtinFunc = builtIns.get(function_name)!;

      try {
        stash.push(builtinFunc(args));
        return;
      } catch (error) {
        // Error
        if (error instanceof Error) {
          throw new Error(error.message);
        } else {
          throw new Error();
        }
        // if (error instanceof RuntimeSourceError) {
        //   throw error;
        // } else {
        //   throw new RuntimeSourceError(`Error in builtin function ${funcName}: ${error}`);
        // }
      }
    }
  },

  [InstrType.BRANCH]: function (
    command: ControlItem,//BranchInstr,
    context: Context,
    control: Control,
    stash: Stash
  ) {
    const test = stash.pop();

    // const error = rttc.checkIfStatement(command.srcNode, test, context.chapter);
    // if (error) {
    //   handleRuntimeError(context, error);
    // }

    if (test.value) {
      if (!valueProducing((command as BranchInstr).consequent)) {
        control.push(identifier('undefined', (command as BranchInstr).consequent.loc));
      }
      ((command as BranchInstr).consequent as ControlItem).skipEnv = true;
      control.push((command as BranchInstr).consequent);
    } else if ((command as BranchInstr).alternate) {
      if (!valueProducing((command as BranchInstr).alternate!)) {
        control.push(identifier('undefined', (command as BranchInstr).alternate!.loc));
      }
      ((command as BranchInstr).alternate as ControlItem).skipEnv = true;
      control.push((command as BranchInstr).alternate!);
    } else {
      control.push(identifier('undefined', (command as BranchInstr).srcNode.loc));
    }
  },

  [InstrType.ENVIRONMENT]: function (
    command: ControlItem, //EnvInstr,
    context: Context
  ) {
    while (currentEnvironment(context).id !== (command as EnvInstr).env.id) {
      popEnvironment(context);
    }
  },

  // [InstrType.ARRAY_LITERAL]: function (
  //   command: ArrLitInstr,
  //   context: Context,
  //   control: Control,
  //   stash: Stash
  // ) {
  //   const arity = command.arity;
  //   const array: any[] = [];
  //   for (let i = 0; i < arity; ++i) {
  //     array.unshift(stash.pop());
  //   }
  //   handleArrayCreation(context, array);
  //   stash.push(array);
  // },

  // [InstrType.ARRAY_ACCESS]: function (
  //   command: Instr,
  //   context: Context,
  //   control: Control,
  //   stash: Stash
  // ) {
  //   const index = stash.pop();
  //   const array = stash.pop();
  //   stash.push(array[index]);
  // },

  // [InstrType.ARRAY_ASSIGNMENT]: function (
  //   command: Instr,
  //   context: Context,
  //   control: Control,
  //   stash: Stash
  // ) {
  //   const value = stash.pop();
  //   const index = stash.pop();
  //   const array = stash.pop();
  //   array[index] = value;
  //   stash.push(value);
  // },

  // [InstrType.CONTINUE]: function (
  //   command: Instr,
  //   context: Context,
  //   control: Control,
  //   stash: Stash
  // ) {
  //   const next = control.pop() as ControlItem;
  //   if (isInstr(next) && next.instrType === InstrType.CONTINUE_MARKER) {
  //   } else if (isInstr(next) && next.instrType === InstrType.ENVIRONMENT) {
  //     control.push(command);
  //     control.push(next); 
  //   } else {
  //     control.push(command);
  //   }
  // },

  // [InstrType.CONTINUE_MARKER]: function () {
  // },

  // [InstrType.BREAK]: function (
  //   command: Instr,
  //   context: Context,
  //   control: Control,
  //   stash: Stash
  // ) {
  //   const next = control.pop() as ControlItem;
  //   if (isInstr(next) && next.instrType === InstrType.BREAK_MARKER) {
  //   } else if (isInstr(next) && next.instrType === InstrType.ENVIRONMENT) {
  //     control.push(command);
  //     control.push(next);
  //   } else {
  //     control.push(command);
  //   }
  // },

  // [InstrType.BREAK_MARKER]: function () {
  // }
};
