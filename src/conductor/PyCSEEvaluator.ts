// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { runInContext, IOptions } from "../runner/pyRunner";
import { Context } from "../cse-machine/context";
import { BasicEvaluator, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { Finished } from "../types";
import { Group, GroupName } from "../stdlib/utils";

const defaultContext = new Context();
const defaultOptions: IOptions = {
  isPrelude: false,
  groups: [],
  envSteps: 100000,
  stepLimit: 100000,
};

export default abstract class PyCSEEvaluator extends BasicEvaluator {
  private context: Context;
  private options: IOptions;
  readonly chapter: number; // AM: do we want to re-create the JS-Slang chapter enum?
  readonly groups: Group[];

  constructor(conductor: IRunnerPlugin, options: Partial<IOptions> = {}, chapter: number, groups: Group[]) {
    super(conductor);
    this.context = defaultContext;
    this.options = { ...defaultOptions, groups: groups, ...options };
    this.chapter = chapter;
    this.groups = groups;
  }

  async evaluateChunk(chunk: string): Promise<void> {
    try {
      const result = await runInContext(
        chunk, // Code
        this.context,
        this.options
      );
      this.conductor.sendOutput(
        `${(result as Finished).representation.toString(
          (result as Finished).value
        )}`
      );
    } catch (error) {
      this.conductor.sendOutput(
        `Error: ${error instanceof Error ? error.message : error}`
      );
    }
  }
}