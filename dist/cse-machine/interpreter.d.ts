/**
 * This interpreter implements an explicit-control evaluator.
 *
 * Heavily adapted from https://github.com/source-academy/JSpike/
 */
import * as es from 'estree';
import { Control } from './control';
import { Stash, Value } from './stash';
import { Context } from './context';
import { RecursivePartial, Result } from '../types';
import { IOptions } from '..';
export declare function addPrint(str: string): void;
/**
 * Function that returns the appropriate Promise<Result> given the output of CSE machine evaluating, depending
 * on whether the program is finished evaluating, ran into a breakpoint or ran into an error.
 * @param context The context of the program.
 * @param value The value of CSE machine evaluating the program.
 * @returns The corresponding promise.
 */
export declare function CSEResultPromise(context: Context, value: Value): Promise<Result>;
/**
 * Function to be called when a program is to be interpreted using
 * the explicit control evaluator.
 *
 * @param program The program to evaluate.
 * @param context The context to evaluate the program in.
 * @param options Evaluation options.
 * @returns The result of running the CSE machine.
 */
export declare function evaluate(program: es.Program, context: Context, options?: RecursivePartial<IOptions>): Value;
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
export declare function generateCSEMachineStateStream(context: Context, control: Control, stash: Stash, envSteps: number, stepLimit: number, isPrelude?: boolean): Generator<{
    stash: Stash;
    control: Control;
    steps: number;
}, void, unknown>;
