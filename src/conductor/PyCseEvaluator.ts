import { ErrorType } from "@sourceacademy/conductor/common";
import { BasicEvaluator, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { Context } from "../engines/cse/context";
import { Control } from "../engines/cse/control";
import { evaluate } from "../engines/cse/interpreter";
import { Stash } from "../engines/cse/stash";
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
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import pairmutator from "../stdlib/pairmutator";
import parser from "../stdlib/parser";
import stream from "../stdlib/stream";
import { Group } from "../stdlib/utils";
import { CseMachinePlugin } from "@sourceacademy/runner-cse-machine";
import { collectSnapshots } from "./plugins/PyCseMachinePlugin";

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
  private readonly csePlugin: CseMachinePlugin;

  protected constructor(conductor: IRunnerPlugin, variant: number, groups: Group[]) {
    super(conductor);
    this.variant = variant;
    this.groups = groups;
    // Cast bridges the IPlugin type difference between this repo's (local/portal)
    // conductor and the one @sourceacademy/runner-cse-machine builds against. Once both
    // use the same published conductor, the cast can be removed.
    this.csePlugin = conductor.registerPlugin(
      CseMachinePlugin as never,
    ) as unknown as CseMachinePlugin;

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

      const control = new Control(ast);
      const stash = new Stash();
      this.context.control = control;
      this.context.stash = stash;

      // The CSE machine visualiser is only available for Python chapters 3 and 4
      // (mirrors Source, where chapters 1-2 use the substituter/stepper instead).
      // For chapters 1-2 we still evaluate the program but emit no snapshots, so the
      // CSE machine tab never appears (it is shown via hasCseSnapshots on the frontend).
      if (this.variant >= 3) {
        const configRaw = await this.conductor.requestFile('/__cse_config__');
        const maxSnapshots: number = configRaw
          ? (JSON.parse(configRaw) as { stepLimit?: number }).stepLimit ?? 1000
          : 1000;

        const snapshots = await collectSnapshots(
          this.context,
          control,
          stash,
          100000,
          -1,
          this.variant,
          script,
          maxSnapshots,
        );
        this.csePlugin.sendSnapshots(snapshots);
      } else {
        // Chapters 1-2: run the program to completion (for stdout/errors) without
        // collecting snapshots.
        await collectSnapshots(this.context, control, stash, 100000, -1, this.variant, script, 0);
      }
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
    super(conductor, 1, [misc, math]);
  }
}

export class PyCseEvaluator2 extends PyCseEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 2, [misc, math, linkedList]);
  }
}

export class PyCseEvaluator3 extends PyCseEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 3, [misc, math, linkedList, list, pairmutator, stream]);
  }
}

export class PyCseEvaluator4 extends PyCseEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 4, [misc, math, linkedList, list, pairmutator, stream, parser]);
  }
}
