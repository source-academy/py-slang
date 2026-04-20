import { ErrorType } from "@sourceacademy/conductor/common";
import { BasicEvaluator, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { Context } from "../engines/cse/context";
import { evaluate } from "../engines/cse/interpreter";
import {
  createErrorStream,
  createInputStream,
  createOutputStream,
  destroyStreams,
  displayError,
} from "../engines/cse/streams";
import { parse } from "../parser/parser-adapter";
import { analyze } from "../resolver/analysis";
import linkedList from "../stdlib/linked-list";
import list from "../stdlib/list";
import pairmutator from "../stdlib/pairmutator";
import parser from "../stdlib/parser";
import stream from "../stdlib/stream";
import { Group } from "../stdlib/utils";

function once<T>(fn: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | undefined;
  return () => (promise ??= fn());
}

/**
 * The abstract class PyCseEvaluatorBase implements the common logic for all variants of
 * the CSE evaluator, which includes setting up the context, loading preludes, and evaluating chunks of code.
 */
abstract class PyCseEvaluatorBase extends BasicEvaluator {
  private context = new Context();
  private readonly variant: number;
  private readonly groups: Group[];
  private readonly ensurePreludesLoaded: () => Promise<void>;

  protected constructor(conductor: IRunnerPlugin, variant: number, groups: Group[]) {
    super(conductor);
    this.variant = variant;
    this.groups = groups;

    for (const group of this.groups) {
      for (const [name, value] of group.builtins) {
        this.context.nativeStorage.builtins.set(name, value);
      }
    }

    this.ensurePreludesLoaded = once(async () => {
      let prelude = "";
      for (const group of this.groups) {
        if (group.prelude) {
          prelude += group.prelude + "\n";
        }
      }
      const ast = parse(prelude + "\n");
      await evaluate(prelude, ast, this.context, {
        isPrelude: true,
        variant: this.variant,
        groups: [],
      });
      if (this.context.errors.length > 0) {
        throw this.context.errors;
      }
    });
  }

  async evaluateChunk(chunk: string): Promise<void> {
    try {
      this.context.streams = {
        initialised: true,
        stdout: createOutputStream(this.conductor),
        stderr: createErrorStream(this.conductor),
        stdin: createInputStream(this.conductor),
      };

      await this.ensurePreludesLoaded();

      const script = chunk + "\n";
      const ast = parse(script);
      const errors = analyze(
        ast,
        script,
        this.variant,
        this.groups,
        Object.keys(this.context.runtime.environments[0].head),
      );

      if (errors.length > 0) {
        throw errors;
      }

      await evaluate(script, ast, this.context, {
        variant: this.variant,
        groups: this.groups,
      });
    } catch (e) {
      const errors = Array.isArray(e) ? e : [e];
      await Promise.all(
        errors.map(e => {
          if (e instanceof SyntaxError) {
            return displayError(this.context, e, ErrorType.EVALUATOR_SYNTAX);
          }
          return displayError(this.context, e, ErrorType.INTERNAL);
        }),
      );
    } finally {
      await destroyStreams(this.context);
    }
  }
}

export class PyCseEvaluator1 extends PyCseEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 1, []);
  }
}

export class PyCseEvaluator2 extends PyCseEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 2, [linkedList]);
  }
}

export class PyCseEvaluator3 extends PyCseEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 3, [linkedList, list, pairmutator, stream]);
  }
}

export class PyCseEvaluator4 extends PyCseEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 4, [linkedList, list, pairmutator, stream, parser]);
  }
}
