import { StmtNS, ExprNS } from '../ast-types';
import { PyContext } from './py_context';
import { PyControl, PyControlItem } from './py_control';
import { PyNode, Instr, InstrType, UnOpInstr, BinOpInstr } from './py_types';
import { Stash, Value, ErrorValue } from './stash';
import { IOptions } from '..';
import * as instr from './py_instrCreator';
import { evaluateUnaryExpression, evaluateBinaryExpression } from './py_operators';
import { TokenType } from '../tokens';
import { Token } from '../tokenizer';
import { Result, Finished, CSEBreak, Representation} from '../types';
import { toPythonString } from '../stdlib'

type CmdEvaluator = (
  command: PyControlItem,
  context: PyContext,
  control: PyControl,
  stash: Stash,
  isPrelude: boolean
) => void

export function PyCSEResultPromise(context: PyContext, value: Value): Promise<Result> {
    return new Promise((resolve, reject) => {
        if (value instanceof CSEBreak) {
            resolve({ status: 'suspended-cse-eval', context });
        } else if (value && (value as any).type === 'error') {
            const errorValue = value as ErrorValue;
            const representation = new Representation(errorValue.message);
            resolve({ status: 'finished', context, value, representation });
        } else {
            const representation = new Representation(toPythonString(value));
            resolve({ status: 'finished', context, value, representation });
        }
    });
}

function mapOperatorToPyOperator(operatorToken: Token): TokenType | string {
    switch (operatorToken.type) {
        case TokenType.PLUS: return '__py_adder';
        case TokenType.MINUS: return '__py_minuser';
        case TokenType.STAR: return '__py_multiplier';
        case TokenType.SLASH: return '__py_divider';
        case TokenType.PERCENT: return '__py_modder';
        case TokenType.DOUBLESTAR: return '__py_powerer';
        // Add other arithmetic operators as needed
        default: return operatorToken.type; // For comparison and unary operators
    }
}

export function PyEvaluate(code: string, program: StmtNS.Stmt, context: PyContext, options: IOptions): Value {
    context.control = new PyControl(program);
    context.runtime.isRunning = true;

    const result = pyRunCSEMachine(code, context, context.control, context.stash, options.isPrelude || false);

    context.runtime.isRunning = false;
    return result;
}

function pyRunCSEMachine(code: string, context: PyContext, control: PyControl, stash: Stash, isPrelude: boolean): Value {
    let command = control.peek();

    while (command) {
        control.pop();

        if ('instrType' in command) {
            const instr = command as Instr;
            if (pyCmdEvaluators[instr.instrType]) {
                pyCmdEvaluators[instr.instrType](instr, context, control, stash, isPrelude);
            } else {
                throw new Error(`Unknown instruction type: ${instr.instrType}`);
            }
        } else {
            const node = command as PyNode;
            const nodeType = node.constructor.name;
            if (pyCmdEvaluators[nodeType]) {
                pyCmdEvaluators[nodeType](node, context, control, stash, isPrelude);
            } else {
                throw new Error(`Unknown Python AST node type: ${nodeType}`);
            }
        }

        command = control.peek();
    }

    const result = stash.peek();
    return result !== undefined ? result : { type: 'undefined' };
}

const pyCmdEvaluators: { [type: string]: CmdEvaluator } = {
    /**
     * AST Node Handlers
     */

    'FileInput': (command, context, control) => {
        const fileInput = command as StmtNS.FileInput;
        const statements = fileInput.statements.slice().reverse();
        control.push(...statements);
    },

    'SimpleExpr': (command, context, control) => {
        const simpleExpr = command as StmtNS.SimpleExpr;
        control.push(simpleExpr.expression);
    },

    'Literal': (command, context, control, stash) => {
        const literal = command as ExprNS.Literal;
        if (typeof literal.value === 'number') {
            stash.push({ type: 'number', value: literal.value });
        } else if (typeof literal.value === 'boolean') {
            stash.push({ type: 'bool', value: literal.value });
        } else if (typeof literal.value === 'string') {
            stash.push({ type: 'string', value: literal.value });
        } else {
            stash.push({ type: 'undefined' }); // For null
        }
    },

    'BigIntLiteral': (command, context, control, stash) => {
        const literal = command as ExprNS.BigIntLiteral;
        stash.push({ type: 'bigint', value: BigInt(literal.value) });
    },

    'Unary': (command, context, control) => {
        const unary = command as ExprNS.Unary;
        const op_instr = instr.unOpInstr(unary.operator.type, unary);
        control.push(op_instr);
        control.push(unary.right);
    },

    'Binary': (command, context, control) => {
        const binary = command as ExprNS.Binary;
        const opStr = mapOperatorToPyOperator(binary.operator);
        const op_instr = instr.binOpInstr(opStr, binary);
        control.push(op_instr);
        control.push(binary.right);
        control.push(binary.left);
    },

    /**
     * Instruction Handlers
     */
    [InstrType.UNARY_OP]: function (command: PyControlItem, context: PyContext, control: PyControl, stash: Stash, isPrelude: boolean) {
        const instr = command as UnOpInstr;
        const argument = stash.pop();
        if (argument) {
            const result = evaluateUnaryExpression(
                instr.symbol,
                argument,
                instr.srcNode as ExprNS.Expr,
                context
            );
            stash.push(result);
        }
    },

    [InstrType.BINARY_OP]: function (command: PyControlItem, context: PyContext, control: PyControl, stash: Stash, isPrelude: boolean) {
        const instr = command as BinOpInstr;
        const right = stash.pop();
        const left = stash.pop();
        if (left && right) {
            const result = evaluateBinaryExpression(
                "", // source string code
                instr.srcNode as ExprNS.Expr,
                context,
                instr.symbol,
                left,
                right
            );
            stash.push(result);
        }
    },
};