import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import type { DataType, IDataHandler, TypedValue } from "@sourceacademy/conductor/types";
import { ModuleLoaderRunnerPlugin } from "@sourceacademy/runner-module-loader";
import {
  Py2JsEvaluator1,
  Py2JsEvaluator2,
  Py2JsEvaluator3,
  Py2JsEvaluator4,
} from "../conductor/Py2JsEvaluator";
import {
  PyCseEvaluator1,
  PyCseEvaluator2,
  PyCseEvaluator3,
  PyCseEvaluator4,
} from "../conductor/PyCseEvaluator";

export type EvaluatorEngine = "py2js" | "pycse";

export interface CapturedEvaluatorError {
  name: string;
  message: string;
}

export interface EvaluatorTestHarness {
  readonly dataHandler: IDataHandler;
  readonly errors: CapturedEvaluatorError[];
  readonly outputs: string[];
  readonly results: unknown[];
  evaluate(code: string): Promise<void>;
  installModule(
    moduleName: string,
    exports: { symbol: string; value: TypedValue<DataType> }[],
  ): void;
}

type Evaluator = { evaluateChunk(chunk: string): Promise<void> };
type EvaluatorConstructor = new (conductor: IRunnerPlugin) => Evaluator;

const EVALUATORS: Record<EvaluatorEngine, readonly EvaluatorConstructor[]> = {
  py2js: [Py2JsEvaluator1, Py2JsEvaluator2, Py2JsEvaluator3, Py2JsEvaluator4],
  pycse: [PyCseEvaluator1, PyCseEvaluator2, PyCseEvaluator3, PyCseEvaluator4],
};

/**
 * Constructs either conductor evaluator behind one observation API. The mock
 * captures the IDataHandler passed to ModuleLoaderRunnerPlugin, so tests can
 * build genuine module exports without reaching into evaluator internals.
 */
export function makeEvaluatorTestHarness(
  engine: EvaluatorEngine,
  variant = 1,
): EvaluatorTestHarness {
  const errors: CapturedEvaluatorError[] = [];
  const outputs: string[] = [];
  const results: unknown[] = [];
  let dataHandler: IDataHandler | undefined;

  const conductor = {
    sendResult: (result: unknown) => results.push(result),
    sendError: (error: unknown) => {
      const errorLike = error as { name?: unknown; message?: unknown };
      errors.push({
        name: typeof errorLike?.name === "string" ? errorLike.name : "Error",
        message: typeof errorLike?.message === "string" ? errorLike.message : String(error),
      });
    },
    sendOutput: (output: string) => outputs.push(output),
    hostLoadPlugin: () => undefined,
    requestFile: () => Promise.resolve(null),
    requestInput: () => Promise.resolve(""),
    registerPlugin: (...args: unknown[]) => {
      // ModuleLoaderRunnerPlugin is registered with (class, conductor,
      // interfacable evaluator). CSE's snapshot plugin has no extra args.
      if (args.length >= 3) {
        dataHandler = args[2] as IDataHandler;
      }
      return { sendSnapshots: () => undefined };
    },
  } as unknown as IRunnerPlugin;

  const Constructor = EVALUATORS[engine][variant - 1];
  if (!Constructor) {
    throw new Error(`Unsupported evaluator variant: ${variant}`);
  }
  const evaluator = new Constructor(conductor);
  if (!dataHandler) {
    throw new Error(`${engine} did not register a module data handler`);
  }

  return {
    dataHandler,
    errors,
    outputs,
    results,
    evaluate: code => evaluator.evaluateChunk(code),
    installModule: (moduleName, exports) => {
      ModuleLoaderRunnerPlugin.instance = {
        requestModule: (requested: string) =>
          requested === moduleName
            ? Promise.resolve({ exports })
            : Promise.reject(new Error(`No test module named ${requested}`)),
      } as unknown as ModuleLoaderRunnerPlugin;
    },
  };
}

export function resetEvaluatorTestModules(): void {
  ModuleLoaderRunnerPlugin.instance = null;
}
