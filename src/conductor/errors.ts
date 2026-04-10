import { ConductorError } from "@sourceacademy/conductor/common";

/**
 * Wraps any caught value as a ConductorError suitable for conductor.sendError().
 * Preserves name, message, and source-location when available.
 */
export class EvaluatorError extends ConductorError {
  line?: number;
  column?: number;

  constructor(e: unknown) {
    super(e instanceof Error ? e.message : String(e));
    this.name = e instanceof Error ? e.name : "Error";
    const se = e as { location?: { start?: { line: number; column: number } } };
    if (se.location?.start) {
      this.line = se.location.start.line;
      this.column = se.location.start.column;
    }
  }
}
