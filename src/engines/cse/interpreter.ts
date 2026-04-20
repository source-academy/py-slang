/**
 * This interpreter implements an explicit-control evaluator.
 *
 * Heavily adapted from https://github.com/source-academy/JSpike/
 */

/* tslint:disable:max-classes-per-file */

import { ErrorType } from "@sourceacademy/conductor/common";
import { ExprNS, StmtNS } from "../../ast-types";
import * as error from "../../errors/errors";
import { BuiltinReassignmentError, UnsupportedOperandTypeError } from "../../errors/errors";
import { builtIns } from "../../stdlib";
import { Group } from "../../stdlib/utils";
import { Token, TokenType } from "../../tokenizer";
import { CSEBreak, RecursivePartial, Result } from "../../types";
import { Closure, isStatementSequence } from "./closure";
import { Context } from "./context";
import { Control, ControlItem } from "./control";
import {
  createEnvironment,
  createProgramEnvironment,
  currentEnvironment,
  popEnvironment,
  pushEnvironment,
} from "./environment";
import { handleRuntimeError, UnknownEvaluatorError } from "./error";
import * as instrCreator from "./instrCreator";
import { evaluateBinaryExpression, evaluateUnaryExpression, isFalsy } from "./operators";
import { Stash, Value } from "./stash";
import { displayError } from "./streams";
import {
  AppInstr,
  AssmtInstr,
  BinOpInstr,
  BoolOpInstr,
  BranchInstr,
  BreakInstr,
  ContinueInstr,
  EndOfFunctionBodyInstr,
  EnvInstr,
  ForInstr,
  Instr,
  InstrType,
  ListAccessInstr,
  ListAssmtInstr,
  ListInstr,
  PopInstr,
  ResetInstr,
  UnOpInstr,
  WhileInstr,
} from "./types";
import {
  envChanging,
  evaluateForIterator,
  evaluateListAssignment,
  generateForIncrement,
  isNode,
  pyDefineVariable,
  pyGetVariable,
  scanForAssignments,
} from "./utils";

export interface IOptions {
  isPrelude: boolean;
  groups: Group[];
  envSteps: number;
  stepLimit: number;
  variant: number;
}

type CmdEvaluator<T extends ControlItem> = (
  code: string,
  command: T,
  context: Context,
  control: Control,
  stash: Stash,
  isPrelude: boolean,
  variant: number,
) => void | Promise<void>;

/**
 * Function that returns the appropriate Promise<Result> given the output of CSE machine evaluating, depending
 * on whether the program is finished evaluating, ran into a breakpoint or ran into an error.
 * @param context The context of the program.
 * @param value The value of CSE machine evaluating the program.
 * @returns The corresponding promise.
 */
export function CSEResultPromise(context: Context, value: Value): Promise<Result> {
  return new Promise((resolve, _reject) => {
    if (value instanceof CSEBreak) {
      resolve({ status: "suspended-cse-eval", context });
    } else if (value.type === "error") {
      resolve({ status: "finished", context, value });
    } else {
      resolve({ status: "finished", context, value });
    }
  });
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
export async function evaluate(
  code: string,
  program: StmtNS.Stmt,
  context: Context,
  options: RecursivePartial<IOptions> = {},
): Promise<Value> {
  const opts: IOptions = {
    isPrelude: false,
    groups: [],
    envSteps: 100000,
    stepLimit: -1,
    variant: 4,
    ...(options as Partial<IOptions>),
  };

  source = code;

  try {
    // TODO: is undefined variables check necessary for Python?
    // checkProgramForUndefinedVariables(program, context)
  } catch (error) {
    return displayError(context, error, ErrorType.EVALUATOR_RUNTIME);
  }

  try {
    context.runtime.isRunning = true;
    context.control = new Control(program);
    context.stash = new Stash();

    // Adaptation for new feature
    const result = await runCSEMachine(
      code,
      context,
      context.control,
      context.stash,
      opts.envSteps,
      opts.stepLimit,
      opts.variant,
      opts.isPrelude,
    );
    return result;
  } catch (error) {
    return await displayError(context, error, ErrorType.EVALUATOR_RUNTIME);
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
 * @param variant The language variant being executed.
 * @param isPrelude Whether the program is the prelude.
 * @returns The top value of the stash after execution.
 */
export async function runCSEMachine(
  code: string,
  context: Context,
  control: Control,
  stash: Stash,
  envSteps: number,
  stepLimit: number,
  variant: number,
  isPrelude: boolean = false,
): Promise<Value> {
  const eceState = generateCSEMachineStateStream(
    code,
    context,
    control,
    stash,
    envSteps,
    stepLimit,
    variant,
    isPrelude,
  );

  // Execute the generator until it completes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for await (const _value of eceState) {
  }

  // Return the value at the top of the storage as the result
  const result = stash.peek();
  return result !== undefined ? result : { type: "none" };
}

/**
 * Generator function that yields the state of the CSE Machine at each step.
 *
 * @param context The context of the program.
 * @param control The control stack.
 * @param stash The stash storage.
 * @param _envSteps Number of environment steps to run.
 * @param stepLimit Maximum number of steps to execute.
 * @param variant The language variant being executed.
 * @param isPrelude Whether the program is the prelude.
 * @yields The current state of the stash, control stack, and step count.
 */
export async function* generateCSEMachineStateStream(
  code: string,
  context: Context,
  control: Control,
  stash: Stash,
  _envSteps: number,
  stepLimit: number,
  variant: number,
  isPrelude: boolean = false,
) {
  // steps: number of steps completed
  let steps = 0;

  let command = control.peek();

  // Push first node to be evaluated into context.
  // The typeguard is there to guarantee that we are pushing a node (which should always be the case)
  if (command && isNode(command)) {
    context.runtime.nodes.unshift(command);
  }

  while (command) {
    // Return to capture a snapshot of the control and stash after the target step count is reached
    // if (!isPrelude && steps === envSteps) {
    //   yield { stash, control, steps }
    //   return
    // }

    // Step limit reached, stop further evaluation
    if (!isPrelude && steps === stepLimit) {
      const node = isNode(command) ? command : command.srcNode;
      const stmtOrExpr = isStatementSequence(node) ? node.body[0] : node;
      handleRuntimeError(context, new error.StepLimitExceededError(source, stmtOrExpr));
    }

    if (!isPrelude && envChanging(command)) {
      // command is evaluated on the next step
      // Hence, next step will change the environment
      context.runtime.changepointSteps.push(steps + 1);
    }
    control.pop();
    if (isNode(command)) {
      const node = command;

      context.runtime.nodes.shift();
      context.runtime.nodes.unshift(command);
      const nodeKind = node.kind;
      if (!isDeclaredEvaluator(nodeKind)) {
        handleRuntimeError(context, new UnknownEvaluatorError(node.kind));
      }
      await cmdEvaluators[nodeKind](
        code,
        node as never,
        context,
        control,
        stash,
        isPrelude,
        variant,
      );

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
      const instrType = command.instrType;
      if (!isDeclaredEvaluator(instrType)) {
        handleRuntimeError(context, new UnknownEvaluatorError(command.instrType));
      }
      await cmdEvaluators[instrType](
        code,
        command as never,
        context,
        control,
        stash,
        isPrelude,
        variant,
      );
    }

    command = control.peek();

    steps += 1;
    if (!isPrelude) {
      context.runtime.envStepsTotal = steps;
    }

    yield { stash, control, steps };
  }
}
function isDeclaredEvaluator(kind: string): kind is keyof CmdEvaluators {
  return kind in cmdEvaluators;
}
type ExprKeys = Exclude<keyof typeof ExprNS, "Expr" | "MultiLambda" | "Starred">;
type StmtKeys = Exclude<
  keyof typeof StmtNS,
  "Stmt" | "AnnAssign" | "Global" | "Assert" | "NonLocal"
>;
type InstrKeys = Exclude<
  InstrType,
  "Assert" | "Global" | "NonLocal" | "Import" | "Program"
>;
type CmdEvaluators = {
  [K in ExprKeys]: CmdEvaluator<InstanceType<(typeof ExprNS)[K]>>;
} & {
  [K in StmtKeys]: CmdEvaluator<InstanceType<(typeof StmtNS)[K]>>;
} & {
  [K in InstrKeys]: CmdEvaluator<Extract<Instr, { instrType: K }>>;
};
const cmdEvaluators: CmdEvaluators = {
  /**
   * AST Nodes
   */

  FileInput: function (
    _code: string,
    fileInput: StmtNS.FileInput,
    context: Context,
    control: Control,
    _stash: Stash,
    isPrelude: boolean,
  ) {
    // Clean up non-global, non-program, and non-preparation environments
    while (
      currentEnvironment(context).name !== "global" &&
      currentEnvironment(context).name !== "programEnvironment" &&
      currentEnvironment(context).name !== "prelude"
    ) {
      popEnvironment(context);
    }

    // Create a new program environment if needed.
    if (
      fileInput.statements.length > 0 &&
      currentEnvironment(context).name !== "programEnvironment"
    ) {
      const programEnv = createProgramEnvironment(context, isPrelude);
      pushEnvironment(context, programEnv);
    }

    // Push the block body as a sequence of statements onto the control stack
    const seq = fileInput.statements.slice().reverse();
    control.push(...seq);
  },

  SimpleExpr: function (
    _code: string,
    simpleExpr: StmtNS.SimpleExpr,
    _context: Context,
    control: Control,
    _stash: Stash,
    _isPrelude: boolean,
  ) {
    // Discard the evaluated expression off the stack,
    // since Python statements are not value producing
    control.push(instrCreator.popInstr(simpleExpr));
    control.push(simpleExpr.expression);
  },

  Literal: function (
    _code: string,
    literal: ExprNS.Literal,
    _context: Context,
    _control: Control,
    stash: Stash,
    _isPrelude: boolean,
  ) {
    if (typeof literal.value === "number") {
      stash.push({ type: "number", value: literal.value });
    } else if (typeof literal.value === "boolean") {
      stash.push({ type: "bool", value: literal.value });
    } else if (typeof literal.value === "string") {
      stash.push({ type: "string", value: literal.value });
    } else {
      stash.push({ type: "none" });
    }
  },

  BigIntLiteral: function (
    _code: string,
    bigIntLiteral: ExprNS.BigIntLiteral,
    _context: Context,
    _control: Control,
    stash: Stash,
    _isPrelude: boolean,
  ) {
    stash.push({ type: "bigint", value: BigInt(bigIntLiteral.value) });
  },

  Unary: function (
    _code: string,
    unary: ExprNS.Unary,
    _context: Context,
    control: Control,
    _stash: Stash,
    _isPrelude: boolean,
  ) {
    const op_instr = instrCreator.unOpInstr(unary.operator.type, unary);
    control.push(op_instr);
    control.push(unary.right);
  },

  Binary: function (
    _code: string,
    binary: ExprNS.Binary,
    _context: Context,
    control: Control,
    _stash: Stash,
    _isPrelude: boolean,
  ) {
    const op_instr = instrCreator.binOpInstr(binary.operator.type, binary);
    control.push(op_instr);
    control.push(binary.right);
    control.push(binary.left);
  },

  BoolOp: function (
    _code: string,
    boolOp: ExprNS.BoolOp,
    _context: Context,
    control: Control,
    _stash: Stash,
    _isPrelude: boolean,
  ) {
    control.push(instrCreator.boolOpInstr(boolOp.operator.type, boolOp));
    control.push(boolOp.left);
  },

  Grouping: function (
    _code: string,
    grouping: ExprNS.Grouping,
    _context: Context,
    control: Control,
    _stash: Stash,
    _isPrelude: boolean,
  ) {
    control.push(grouping.expression);
  },

  Complex: function (
    _code: string,
    complex: ExprNS.Complex,
    _context: Context,
    _control: Control,
    stash: Stash,
    _isPrelude: boolean,
  ) {
    stash.push({ type: "complex", value: complex.value });
  },

  None: function (
    _code: string,
    _command: ExprNS.None,
    _context: Context,
    _control: Control,
    stash: Stash,
    _isPrelude: boolean,
  ) {
    stash.push({ type: "none" });
  },

  Variable: function (
    code: string,
    variable: ExprNS.Variable,
    context: Context,
    _control: Control,
    stash: Stash,
    _isPrelude: boolean,
  ) {
    const name = variable.name.lexeme;

    // if not built in, look up in environment
    const value = pyGetVariable(code, context, name, variable);
    stash.push(value);
  },

  Compare: function (
    _code: string,
    compareNode: ExprNS.Compare,
    _context: Context,
    control: Control,
    _stash: Stash,
    _isPrelude: boolean,
  ) {
    const op_instr = instrCreator.binOpInstr(compareNode.operator.type, compareNode);

    control.push(op_instr);
    control.push(compareNode.right);
    control.push(compareNode.left);
  },

  Assign: function (
    _code: string,
    assignNode: StmtNS.Assign,
    _context: Context,
    control: Control,
    _stash: Stash,
    _isPrelude: boolean,
  ) {
    if (assignNode.target instanceof ExprNS.Subscript) {
      control.push(instrCreator.listAssmtInstr(assignNode.target));
      control.push(assignNode.value);
      control.push(assignNode.target.index);
      control.push(assignNode.target.value);
      return;
    }

    const assmtInstr = instrCreator.assmtInstr(
      assignNode.target.name.lexeme,
      false,
      true,
      assignNode,
    );

    control.push(assmtInstr);
    control.push(assignNode.value);
  },

  Call: function (
    _code: string,
    callNode: ExprNS.Call,
    _context: Context,
    control: Control,
    _stash: Stash,
    _isPrelude: boolean,
  ) {
    const spreadIndices = callNode.args.reduce<number[]>((acc, arg, i) => {
      if (arg instanceof ExprNS.Starred) acc.push(i);
      return acc;
    }, []);

    control.push(instrCreator.appInstr(callNode.args.length, callNode, spreadIndices));
    for (let i = callNode.args.length - 1; i >= 0; i--) {
      const arg = callNode.args[i];
      // Push the inner expression for Starred nodes — the spread flattening
      // happens at application time using spreadIndices.
      control.push(arg instanceof ExprNS.Starred ? arg.value : arg);
    }
    control.push(callNode.callee);
  },

  FunctionDef: function (
    _code: string,
    functionDefNode: StmtNS.FunctionDef,
    context: Context,
    _control: Control,
    _stash: Stash,
    _isPrelude: boolean,
  ) {
    const localVariables = scanForAssignments(functionDefNode.body);
    const closure = Closure.makeFromFunctionDef(
      functionDefNode,
      currentEnvironment(context),
      context,
      localVariables,
    );
    pyDefineVariable(context, functionDefNode.name.lexeme, { type: "closure", closure });
  },

  Lambda: function (
    _code: string,
    lambdaNode: ExprNS.Lambda,
    context: Context,
    _control: Control,
    stash: Stash,
    _isPrelude: boolean,
  ) {
    const localVariables = scanForAssignments(lambdaNode.body);
    const closure = Closure.makeFromLambda(
      lambdaNode,
      currentEnvironment(context),
      context,
      localVariables,
    );
    stash.push({ type: "closure", closure });
  },

  Return: function (
    _code: string,
    returnNode: StmtNS.Return,
    _context: Context,
    control: Control,
    stash: Stash,
    _isPrelude: boolean,
  ) {
    let head;
    while (true) {
      head = control.pop();
      if (!head || ("instrType" in head && head.instrType === InstrType.RESET)) {
        break;
      }
    }
    if (head) {
      control.push(head);
    }
    if (returnNode.value) {
      control.push(returnNode.value);
    } else {
      // implicit None return
      stash.push({ type: "none" });
    }
  },

  For: function (
    code: string,
    command: StmtNS.For,
    context: Context,
    control: Control,
    _stash: Stash,
    _isPrelude: boolean,
  ) {
    const iterator = evaluateForIterator(code, context, command);

    control.push(instrCreator.forInstr(command, command.body));
    control.push(iterator.step);
    control.push(iterator.end);
    control.push(iterator.start);
  },

  While: function (
    _code: string,
    whileNode: StmtNS.While,
    _context: Context,
    control: Control,
    _stash: Stash,
    _isPrelude: boolean,
  ) {
    const instr = instrCreator.whileInstr(whileNode, whileNode.condition, {
      kind: "StatementSequence",
      body: whileNode.body,
    });
    control.push(instr);
    control.push(whileNode.condition);
  },

  Break: function (
    _code: string,
    command: StmtNS.Break,
    _context: Context,
    control: Control,
    _stash: Stash,
    _isPrelude: boolean,
  ) {
    control.push(instrCreator.breakInstr(command));
  },

  Continue: function (
    _code: string,
    command: StmtNS.Continue,
    _context: Context,
    control: Control,
    _stash: Stash,
    _isPrelude: boolean,
  ) {
    control.push(instrCreator.continueInstr(command));
  },

  If: function (
    _code: string,
    ifNode: StmtNS.If,
    _context: Context,
    control: Control,
    _stash: Stash,
    _isPrelude: boolean,
  ) {
    const branch = instrCreator.branchInstr(
      { kind: "StatementSequence", body: ifNode.body },
      ifNode.elseBlock
        ? Array.isArray(ifNode.elseBlock)
          ? // 'else' block
            { kind: "StatementSequence", body: ifNode.elseBlock }
          : // 'elif' block
            ifNode.elseBlock
        : // 'else' block dont exist
          null,
      ifNode,
    );
    control.push(branch);
    control.push(ifNode.condition);
  },

  List: function (
    _code: string,
    command: ExprNS.List,
    _context: Context,
    control: Control,
    _stash: Stash,
    _isPrelude: boolean,
  ) {
    control.push(instrCreator.listInstr(command.elements.length, command));

    for (let i = command.elements.length - 1; i >= 0; i--) {
      control.push(command.elements[i]);
    }
  },

  Subscript: function (
    _code: string,
    subscriptNode: ExprNS.Subscript,
    _context: Context,
    control: Control,
    _stash: Stash,
    _isPrelude: boolean,
  ) {
    control.push(instrCreator.listAccessInstr(subscriptNode));
    control.push(subscriptNode.index);
    control.push(subscriptNode.value);
  },

  Ternary: function (
    _code: string,
    ternaryNode: ExprNS.Ternary,
    _context: Context,
    control: Control,
    _stash: Stash,
    _isPrelude: boolean,
  ) {
    const branch = instrCreator.branchInstr(
      ternaryNode.consequent,
      ternaryNode.alternative,
      ternaryNode,
    );
    control.push(branch);
    control.push(ternaryNode.predicate);
  },

  FromImport: function () {
    // TODO: nothing to do for now, we can implement it for CSE instructions later on
    // All modules are preloaded into the global environment by the runner.
    // When the code later uses the module name (e.g., 'runes'), pyGetVariable
    // will find it in the global scope.
  },

  Pass: function () {
    // No action needed for 'pass' statement
  },

  /**
   * Instructions
   */
  [InstrType.RESET]: function (
    _code: string,
    _command: ResetInstr,
    context: Context,
    _control: Control,
    _stash: Stash,
    _isPrelude: boolean,
  ) {
    popEnvironment(context);
  },

  [InstrType.ASSIGNMENT]: function (
    code: string,
    instr: AssmtInstr,
    context: Context,
    _control: Control,
    stash: Stash,
    _isPrelude: boolean,
  ) {
    const value = stash.pop();

    if (value) {
      if (builtIns.has(instr.symbol)) {
        handleRuntimeError(
          context,
          new BuiltinReassignmentError(code, instr.symbol, instr.srcNode as ExprNS.Expr),
        );
      }
      pyDefineVariable(context, instr.symbol, value);
    }
  },

  [InstrType.LIST_ASSIGNMENT]: function (
    code: string,
    instr: ListAssmtInstr,
    context: Context,
    _control: Control,
    stash: Stash,
    _isPrelude: boolean,
  ) {
    const value = stash.pop();
    const index = stash.pop();
    const list = stash.pop();

    evaluateListAssignment(code, instr.srcNode as StmtNS.Assign, context, list, index, value);
  },

  [InstrType.BREAK]: function (
    _code: string,
    command: BreakInstr,
    _context: Context,
    control: Control,
    _stash: Stash,
    _isPrelude: boolean,
  ) {
    const top = control.peek();
    if (!top) {
      return;
    }
    if (isNode(top) || (top.instrType !== InstrType.WHILE && top.instrType !== InstrType.FOR)) {
      control.pop();
      control.push(command);
      return;
    }
    control.pop();
  },

  [InstrType.CONTINUE]: function (
    _code: string,
    command: ContinueInstr,
    _context: Context,
    control: Control,
    _stash: Stash,
    _isPrelude: boolean,
  ) {
    const top = control.pop();
    if (!top) return;
    if (isNode(top) || top.instrType !== InstrType.CONTINUE_MARKER) {
      control.push(command);
    }
  },

  [InstrType.UNARY_OP]: function (
    code: string,
    instr: UnOpInstr,
    context: Context,
    _control: Control,
    stash: Stash,
    _isPrelude: boolean,
  ) {
    const argument = stash.pop();
    if (argument) {
      const result = evaluateUnaryExpression(
        code,
        instr.srcNode as ExprNS.Unary,
        context,
        instr.symbol,
        argument,
      );
      stash.push(result);
    }
  },

  [InstrType.BINARY_OP]: function (
    code: string,
    instr: BinOpInstr,
    context: Context,
    _control: Control,
    stash: Stash,
    _isPrelude: boolean,
    variant: number,
  ) {
    const right = stash.pop();
    const left = stash.pop();
    if (left && right && variant) {
      const result = evaluateBinaryExpression(
        code,
        instr.srcNode as ExprNS.Binary,
        context,
        instr.symbol,
        left,
        right,
        variant,
      );
      stash.push(result);
    }
  },

  [InstrType.BOOL_OP]: function (
    code: string,
    instr: BoolOpInstr,
    context: Context,
    control: Control,
    stash: Stash,
    _isPrelude: boolean,
  ) {
    const left = stash.pop();
    const boolOpNode = instr.srcNode as ExprNS.BoolOp;
    const right = boolOpNode.right;
    if (left) {
      if (left.type !== "bool") {
        handleRuntimeError(
          context,
          new UnsupportedOperandTypeError(
            code,
            boolOpNode,
            left.type,
            "",
            boolOpNode.operator.type,
          ),
        );
      }
      const falsy = isFalsy(left);
      const operator = instr.symbol;
      if (operator == TokenType.AND && falsy) {
        stash.push(left);
      } else if (operator == TokenType.AND && !falsy) {
        control.push(right);
      } else if (operator == TokenType.OR && falsy) {
        control.push(right);
      } else {
        stash.push(left);
      }
    }
  },

  [InstrType.POP]: function (
    _code: string,
    _command: PopInstr,
    _context: Context,
    _control: Control,
    stash: Stash,
    _isPrelude: boolean,
  ) {
    stash.pop();
  },

  [InstrType.LIST]: function (
    _code: string,
    instr: ListInstr,
    _context: Context,
    _control: Control,
    stash: Stash,
    _isPrelude: boolean,
  ) {
    const elements: Value[] = [];
    for (let i = 0; i < instr.numOfElements; i++) {
      const element = stash.pop();
      if (element) {
        elements.unshift(element);
      }
    }
    stash.push({ type: "list", value: elements });
  },

  [InstrType.WHILE]: function (
    _code: string,
    instr: WhileInstr,
    _context: Context,
    control: Control,
    stash: Stash,
    _isPrelude: boolean,
  ) {
    const condition = stash.pop();
    if (condition && !isFalsy(condition)) {
      control.push(instr);
      control.push(instr.test);
      control.push(instrCreator.continueMarkerInstr(instr.srcNode));
      control.push(...instr.body.body.slice().reverse());
    }
  },
  [InstrType.FOR]: function (
    code: string,
    command: ControlItem,
    context: Context,
    control: Control,
    stash: Stash,
    _isPrelude: boolean,
  ) {
    const instr = command as ForInstr;
    const step = stash.pop();
    const end = stash.pop();
    const start = stash.pop();
    if (start && end && step) {
      const node = instr.srcNode as StmtNS.For;
      if (start.type !== "bigint" || end.type !== "bigint" || step.type !== "bigint") {
        handleRuntimeError(
          context,
          new error.TypeError(
            code,
            node.iter,
            context,
            [start.type, end.type, step.type].filter(t => t !== "bigint")[0],
            "int",
          ),
        );
      }
      if (
        (step.value <= 0 && end.value >= start.value) ||
        (step.value >= 0 && end.value <= start.value)
      ) {
        return;
      }
      control.push(instr);
      const generateBigIntLiteral = (value: bigint): ExprNS.BigIntLiteral => {
        const token = new Token(TokenType.BIGINT, value.toString(), 0, 0, 0);
        return new ExprNS.BigIntLiteral(token, token, value.toString());
      };
      control.push(generateBigIntLiteral(step.value));
      control.push(generateBigIntLiteral(end.value));
      control.push(generateBigIntLiteral(start.value + step.value));
      control.push(instrCreator.continueMarkerInstr(node));
      control.push(...instr.body.slice().reverse());
      control.push(generateForIncrement(node.target.lexeme, start.value));
    }
  },
  [InstrType.CONTINUE_MARKER]: function () {},
  [InstrType.APPLICATION]: async function (
    code: string,
    instr: AppInstr,
    context: Context,
    control: Control,
    stash: Stash,
    _isPrelude: boolean,
  ) {
    const numOfArgs = instr.numOfArgs;

    const rawArgs: Value[] = [];
    for (let i = 0; i < numOfArgs; i++) {
      const arg = stash.pop();
      if (arg) {
        rawArgs.unshift(arg);
      }
    }

    // Flatten spread args: starred indices contain list values that
    // need to be expanded inline.
    const spreadSet = new Set(instr.spreadIndices);
    const args: Value[] =
      spreadSet.size === 0
        ? rawArgs
        : rawArgs.flatMap((val, i) => {
            if (!spreadSet.has(i)) return val;
            if (val?.type === "list") {
              return val.value;
            }
            handleRuntimeError(
              context,
              new error.TypeError(
                code,
                instr.srcNode,
                context,
                val ? val.type : "NoneType",
                "iterable",
              ),
            );
          });

    const callable = stash.pop();

    if (callable?.type == "closure") {
      const closure = callable.closure;
      control.push(instrCreator.resetInstr(instr.srcNode));
      if (closure.node.kind === "FunctionDef") {
        control.push(instrCreator.endOfFunctionBodyInstr(instr.srcNode));
      }

      const newEnv = createEnvironment(code, context, closure, args, instr.srcNode);
      pushEnvironment(context, newEnv);

      const closureNode = closure.node;
      if (closureNode.kind === "FunctionDef") {
        const bodyStmts = closureNode.body.slice().reverse();
        control.push(...bodyStmts);
      } else {
        const bodyExpr = closureNode.body;
        control.push(bodyExpr);
      }
    } else if (callable?.type === "builtin") {
      const result = await callable.func(args, code, instr.srcNode, context);
      stash.push(result);
    } else {
      handleRuntimeError(
        context,
        new error.TypeError(
          code,
          instr.srcNode,
          context,
          callable ? callable.type : "NoneType",
          "callable",
        ),
      );
    }
  },

  [InstrType.LIST_ACCESS]: function (
    code: string,
    instr: ListAccessInstr,
    context: Context,
    _control: Control,
    stash: Stash,
    _isPrelude: boolean,
  ) {
    const index = stash.pop();
    const list = stash.pop();
    if (!list || (list.type !== "list" && list.type !== "string")) {
      handleRuntimeError(
        context,
        new error.TypeError(
          code,
          instr.srcNode as ExprNS.Expr,
          context,
          list ? list.type : "NoneType",
          "list or string",
        ),
      );
    }
    if (!index || index.type !== "bigint") {
      handleRuntimeError(
        context,
        new error.TypeError(
          code,
          instr.srcNode as ExprNS.Expr,
          context,
          index?.type || "NoneType",
          "int",
        ),
      );
    }
    const idx = Number(index.value);
    // TODO: make this O(1)
    if (idx >= [...list.value].length) {
      handleRuntimeError(
        context,
        new error.IndexError(code, instr.srcNode as ExprNS.Expr, context, idx, list.value.length),
      );
    }
    if (list.type === "string") {
      stash.push({ type: "string", value: [...list.value].at(idx) ?? "" });
    } else {
      stash.push(list.value[idx]);
    }
  },

  [InstrType.BRANCH]: function (
    _code: string,
    instr: BranchInstr,
    _context: Context,
    control: Control,
    stash: Stash,
    _isPrelude: boolean,
  ) {
    const condition = stash.pop();

    if (condition && !isFalsy(condition)) {
      const consequent = instr.consequent;
      if (isStatementSequence(consequent)) {
        control.push(...consequent.body.slice().reverse());
      } else if (consequent) {
        control.push(consequent);
      }
    } else if (instr.alternate) {
      const alternate = instr.alternate;
      if (isStatementSequence(alternate)) {
        control.push(...alternate.body.slice().reverse());
      } else if (alternate) {
        control.push(alternate);
      }
    }
  },

  [InstrType.ENVIRONMENT]: function (
    _code: string,
    command: EnvInstr,
    context: Context,
    _control: Control,
    _stash: Stash,
    _isPrelude: boolean,
  ) {
    while (currentEnvironment(context).id !== command.env.id) {
      popEnvironment(context);
    }
  },

  [InstrType.END_OF_FUNCTION_BODY]: function (
    _code: string,
    _command: EndOfFunctionBodyInstr,
    _context: Context,
    _control: Control,
    stash: Stash,
    _isPrelude: boolean,
  ) {
    stash.push({ type: "none" });
  },
};
