/**
 * Map an engine-thrown exception to an error suitable for conductor.sendError().
 *
 * In production, the conductor accepts ConductorError subclasses. However, the
 * @sourceacademy/conductor package's minified ESM error classes break under
 * Jest's CJS transform (class field initializers before super()). We use a
 * plain object that satisfies the structural interface instead.
 */
interface EvaluatorError {
  name: string;
  errorType: string;
  message: string;
  line?: number;
  column?: number;
}

export function toEvaluatorError(e: unknown): EvaluatorError {
  if (e instanceof Error) {
    const err: EvaluatorError = {
      name: e.name,
      errorType: "runtime",
      message: e.message,
    };
    // Check if it's a SourceError-like object with location info
    const potentialSourceError = e as { location?: { start?: { line: number; column: number } } };
    if (potentialSourceError.location?.start) {
      err.line = potentialSourceError.location.start.line;
      err.column = potentialSourceError.location.start.column;
    }
    return err;
  }
  return { name: "Error", errorType: "runtime", message: String(e) };
}
