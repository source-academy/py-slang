declare const __EVALUATOR__: string;

import { initialise } from "@sourceacademy/conductor/runner";

import { PyCSEEvaluator } from "./conductor/PyCSEEvaluator";
import { PyWasmEvaluator } from "./conductor/PyWasmEvaluator";

const evaluators = {
  PyCSEEvaluator,
  PyWasmEvaluator,
} as const;

const Evaluator = evaluators[__EVALUATOR__ as keyof typeof evaluators];
initialise(Evaluator);

// Re-exports for library consumers
export { PyCSEEvaluator, PyWasmEvaluator };
