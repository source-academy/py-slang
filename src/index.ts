declare const __EVALUATOR__: string;

import { initialise } from "@sourceacademy/conductor/runner";

import { PyCseEvaluator } from "./conductor/PyCseEvaluator";
import { PyWasmEvaluator } from "./conductor/PyWasmEvaluator";

const evaluators = {
  PyCseEvaluator,
  PyWasmEvaluator,
} as const;

const Evaluator = evaluators[__EVALUATOR__ as keyof typeof evaluators];
initialise(Evaluator);

// Re-exports for library consumers
export { PyCseEvaluator, PyWasmEvaluator };
