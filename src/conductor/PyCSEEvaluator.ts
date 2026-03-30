// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { ErrorType } from "@sourceacademy/conductor/common";
import { BasicEvaluator, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { Context } from "../engines/cse/context";
import {
  createErrorStream,
  createInputStream,
  createOutputStream,
  destroyStreams,
  displayError,
} from "../engines/cse/streams";
import { IOptions, runInContext } from "../runner/pyRunner";
import { Group } from "../stdlib/utils";

const defaultContext = new Context();
const defaultOptions: IOptions = {
  isPrelude: false,
  groups: [],
  envSteps: 100000,
  stepLimit: 100000,
  variant: 1,
};

export default abstract class PyCSEEvaluator extends BasicEvaluator {
  private context: Context;
  private options: IOptions;
  readonly chapter: number; // AM: do we want to re-create the JS-Slang chapter enum?
  readonly groups: Group[];

  constructor(
    conductor: IRunnerPlugin,
    options: Partial<IOptions> = {},
    chapter: number,
    groups: Group[],
  ) {
    super(conductor);
    this.context = defaultContext;
    this.options = { ...defaultOptions, groups: groups, variant: chapter, ...options };
    this.chapter = chapter;
    this.groups = groups;
  }

  async evaluateChunk(chunk: string): Promise<void> {
    try {
      this.context.streams = {
        initialised: true,
        stdout: createOutputStream(this.conductor),
        stderr: createErrorStream(this.conductor),
        stdin: createInputStream(this.conductor),
      };
      await runInContext(
        chunk, // Code
        this.context,
        this.options,
      );
    } catch (error) {
      if (error instanceof SyntaxError) {
        await displayError(this.context, error, ErrorType.EVALUATOR_SYNTAX);
        return;
      }
      await displayError(this.context, error, ErrorType.INTERNAL);
    } finally {
      await destroyStreams(this.context);
    }
  }
}
