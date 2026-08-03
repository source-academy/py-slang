import { ErrorType } from "@sourceacademy/conductor/common";
import { BasicEvaluator, type IRunnerPlugin } from "@sourceacademy/conductor/runner";
import { DATA_VISUALIZER_DIRECTORY_ID } from "@sourceacademy/common-data-visualizer";
import { CseMachinePlugin } from "@sourceacademy/runner-cse-machine";
import { ModuleLoaderRunnerPlugin } from "@sourceacademy/runner-module-loader";
import { Context } from "../engines/cse/context";
import { Control } from "../engines/cse/control";
import { evaluate } from "../engines/cse/interpreter";
import { Stash } from "../engines/cse/stash";
import {
  createBufferedOutputStream,
  createErrorStream,
  createInputStream,
  destroyStreams,
  displayError,
} from "../engines/cse/streams";
import { markBreakpoints } from "../breakpoints";
import { parse } from "../parser/parser-adapter";
import { analyze } from "../resolver/analysis";
import dataVisualizer from "../stdlib/dataVisualizer";
import linkedList from "../stdlib/linked-list";
import list from "../stdlib/list";
import math from "../stdlib/math";
import misc from "../stdlib/misc";
import pairmutator from "../stdlib/pairmutator";
import parser from "../stdlib/parser";
import stream from "../stdlib/stream";
import { Group } from "../stdlib/utils";
import { PythonDataVisualizerRunnerPlugin } from "./dataVisualizer/PyDataVisualizerRunnerPlugin";
import { asInterfacableEvaluator, GenericDataHandler } from "./GenericDataHandler";
import { registerAutoCompletePlugin } from "./plugins/autocomplete";
import { collectSnapshots } from "./plugins/PyCseMachinePlugin";
import { fetchRunConfig } from "./runConfig";

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
  private readonly preludeText: string;
  private readonly ensurePreludesLoaded: () => Promise<void>;
  private readonly csePlugin: CseMachinePlugin;
  /** Conductor's module-interop protocol (pairs/arrays/closures/opaques) —
   * see GenericDataHandler.ts. Engine-agnostic, so this is the same instance
   * type py2js's evaluator uses; only the pythonToModule/moduleToPython
   * conversion layer (modules.ts) is CSE-specific. */
  private readonly dataHandler = new GenericDataHandler();
  /** Registered only for §2+ — draw_data doesn't exist as a builtin below that, so there's no
   * reason to register the plugin or have the host fetch its web bundle for §1 users. */
  private readonly dataVisualizerPlugin?: PythonDataVisualizerRunnerPlugin;

  protected constructor(conductor: IRunnerPlugin, variant: number, groups: Group[]) {
    super(conductor);
    this.variant = variant;
    this.groups = groups;
    registerAutoCompletePlugin(conductor, variant);
    this.preludeText = groups.map(g => g.prelude ?? "").join("\n");

    // Cast bridges the IPlugin type difference between this repo's (local/portal)
    // conductor and the one @sourceacademy/runner-cse-machine builds against. Once both
    // use the same published conductor, the cast can be removed.
    this.csePlugin = conductor.registerPlugin(
      CseMachinePlugin as never,
    ) as unknown as CseMachinePlugin;

    if (variant >= 2) {
      this.dataVisualizerPlugin = conductor.registerPlugin(PythonDataVisualizerRunnerPlugin);
      conductor.hostLoadPlugin(DATA_VISUALIZER_DIRECTORY_ID);
    }

    for (const group of this.groups) {
      for (const [name, value] of group.builtins) {
        this.context.nativeStorage.builtins.set(name, value);
      }
    }
    this.conductor.registerPlugin(
      ModuleLoaderRunnerPlugin,
      this.conductor,
      asInterfacableEvaluator(this, this.dataHandler),
    );

    this.ensurePreludesLoaded = once(async () => {
      if (this.preludeText.trim()) {
        const ast = parse(this.preludeText + "\n");
        await evaluate(this.preludeText + "\n", ast, this.context, {
          isPrelude: true,
          variant: this.variant,
          groups: [],
        });
      }
      if (this.context.errors.length > 0) {
        throw this.context.errors;
      }
    });
  }

  async evaluateChunk(chunk: string): Promise<void> {
    const { context: stdout, flush: flushOutput } = createBufferedOutputStream();
    try {
      this.context.streams = {
        initialised: true,
        stdout,
        stderr: createErrorStream(this.conductor),
        stdin: createInputStream(this.conductor),
        flushStdout: () => flushOutput(this.conductor),
      };
      this.context.conductor = this.conductor;
      this.context.evaluator = this.dataHandler;
      this.context.dataVisualizer = this.dataVisualizerPlugin ?? null;
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
      // this.context persists across evaluateChunk calls; reset per-run state that the
      // interpreter accumulates so a prior run's breakpoint()/changepoint steps don't leak
      // into this one.
      this.context.runtime.breakpointSteps = [];
      this.context.runtime.changepointSteps = [];
      this.context.runtime.break = false;
      await this.dataVisualizerPlugin?.resetRun();

      // CSE chapters (3+): collect snapshots up to the step cap, then stop.
      // Output produced after the step cap is not emitted — that's intentional.
      // Chapters 1-2: run to completion via the generator (maxSnapshots=0 → no
      // snapshots collected, CSE tab never appears) so stdout/errors are emitted.
      if (this.variant >= 3) {
        const config = await fetchRunConfig(this.conductor);
        const maxSnapshots = config.stepLimit ?? 1000;
        markBreakpoints(ast, config.breakpointLines ?? []);

        const { snapshots, breakpointSteps } = await collectSnapshots(
          this.context,
          control,
          stash,
          -1,
          this.variant,
          script,
          maxSnapshots,
        );
        flushOutput(this.conductor);
        this.csePlugin.sendSnapshots(snapshots, breakpointSteps);
      } else {
        await collectSnapshots(this.context, control, stash, -1, this.variant, script, 0);
        flushOutput(this.conductor);
      }
    } catch (e) {
      flushOutput(this.conductor);
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
    super(conductor, 2, [misc, math, linkedList, dataVisualizer]);
  }
}

export class PyCseEvaluator3 extends PyCseEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 3, [misc, math, linkedList, list, pairmutator, stream, dataVisualizer]);
  }
}

export class PyCseEvaluator4 extends PyCseEvaluatorBase {
  constructor(conductor: IRunnerPlugin) {
    super(conductor, 4, [
      misc,
      math,
      linkedList,
      list,
      pairmutator,
      stream,
      parser,
      dataVisualizer,
    ]);
  }
}
