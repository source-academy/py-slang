// This file is adapted from:
// https://github.com/source-academy/conductor
// Original author(s): Source Academy Team

import { BasicEvaluator, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { compileToWasmAndRun } from "../engines/wasm";
import linkedList from "../stdlib/linked-list";
import list from "../stdlib/list";
import pairmutator from "../stdlib/pairmutator";
import mce from "../stdlib/parser";
import { Group } from "../stdlib/utils";
import { EvaluatorError } from "./errors";

class PyWasmEvaluator extends BasicEvaluator {
  private readonly chapter: number;
  private readonly groups: Group[];

  protected constructor(conductor: IRunnerPlugin, chapter: number, groups: Group[]) {
    super(conductor);
    this.chapter = chapter;
    this.groups = groups;
  }

  async evaluateChunk(chunk: string): Promise<void> {
    try {
      const { errors, prints, renderedResult } = await compileToWasmAndRun(chunk, true, {
        chapter: this.chapter,
        groups: this.groups,
      });

      if (errors.length > 0) {
        errors.forEach(error => this.conductor.sendError(new EvaluatorError(error)));
        return;
      }

      prints.forEach(print => this.conductor.sendOutput(print));
      if (renderedResult != null) {
        this.conductor.sendOutput(renderedResult);
      }
    } catch (error) {
      this.conductor.sendError(new EvaluatorError(error));
    }
  }

  async evaluateFile(fileName: string, fileContent: string): Promise<void> {
    try {
      const { errors, prints } = await compileToWasmAndRun(fileContent, false, {
        chapter: this.chapter,
        groups: this.groups,
      });

      if (errors.length > 0) {
        errors.forEach(error => this.conductor.sendError(new EvaluatorError(error)));
        return;
      }

      prints.forEach(print => this.conductor.sendOutput(print));
    } catch (error) {
      this.conductor.sendError(new EvaluatorError(error));
    }
  }
}

export class PyWasmEvaluator1 extends PyWasmEvaluator {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 1, []);
  }
}

export class PyWasmEvaluator2 extends PyWasmEvaluator {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 2, [linkedList]);
  }
}

export class PyWasmEvaluator3 extends PyWasmEvaluator {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 3, [linkedList, pairmutator, list]);
  }
}

export class PyWasmEvaluator4 extends PyWasmEvaluator {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 4, [linkedList, pairmutator, list, mce]);
  }
}
