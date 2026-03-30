/**
 * Map an engine-thrown exception to an error suitable for conductor.sendError().
 *
 * In production, the conductor accepts ConductorError subclasses. However, the
 * @sourceacademy/conductor package's minified ESM error classes break under
 * Jest's CJS transform (class field initializers before super()). We use a
 * plain object that satisfies the structural interface instead.
 */
export function toEvaluatorError(e: unknown): { message: string; line?: number; column?: number } {
  if (e instanceof Error) {
    return { message: e.message };
  }
  return { message: String(e) };
}
