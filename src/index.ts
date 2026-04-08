declare const __EVALUATOR__: string;

import { initialise } from "@sourceacademy/conductor/runner";
import {
  PyCseEvaluator1,
  PyCseEvaluator2,
  PyCseEvaluator3,
  PyCseEvaluator4,
} from "./conductor/PyCseEvaluator";
import { PyWasmEvaluator } from "./conductor/PyWasmEvaluator";

/** Single registry of all evaluators. */
const evaluators = {
  PyCseEvaluator1,
  PyCseEvaluator2,
  PyCseEvaluator3,
  PyCseEvaluator4,
  PyWasmEvaluator,
} as const;

type EvaluatorName = keyof typeof evaluators;

initialise(evaluators[__EVALUATOR__ as EvaluatorName]);

// Export back for library consumers
export { evaluators, type EvaluatorName };
