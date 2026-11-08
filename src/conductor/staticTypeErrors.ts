import { ErrorType } from "@sourceacademy/conductor/common";
import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";
import type { StaticTypeError } from "../typecheck/errors";
import { EvaluatorError } from "./errors";

/**
 * How a type error of Typed Python §4 is reported to the host, by any evaluator: with its line and
 * column, and as a type error. (This is apart from ./typed.ts, which has the checker: an evaluator
 * of plain Python §4 reports these too, and is not to contain the checker for that.)
 */
class StaticTypeConductorError extends EvaluatorError {
  override readonly errorType = ErrorType.EVALUATOR_TYPE;
}

export function staticTypeConductorError(error: StaticTypeError): EvaluatorError {
  return new StaticTypeConductorError(error);
}

export function sendStaticTypeErrors(
  conductor: IRunnerPlugin,
  errors: readonly StaticTypeError[],
): void {
  for (const error of errors) conductor.sendError(staticTypeConductorError(error));
}
