import type { IRunnerPlugin } from "@sourceacademy/conductor/runner";

/**
 * Per-run configuration the host serves via a virtual `/__cse_config__` file (fetched through
 * {@link IRunnerPlugin.requestFile}, the only generic inbound channel Conductor offers — there is
 * no dedicated message type for either of these in `@sourceacademy/conductor`).
 */
export interface RunConfig {
  /** User-configured step limit (the frontend's "Step Limit" control), applied as the CSE
   * machine tab's snapshot cap (see `PyCseEvaluator.ts`) and the Stepper tab's step budget (see
   * `PyStepperEvaluator.ts`/`PyStepperRunnerPlugin.ts`). Default: 1000. */
  stepLimit?: number;
  /**
   * Lines the host's gutter-click breakpoints (the ace editor's red dots) currently sit on, for
   * issue #383. Resolved to their closest enclosing statement by `markBreakpoints`
   * (`../breakpoints.ts`) before evaluation/stepping starts.
   */
  breakpointLines?: number[];
}

/** Fetches and parses `/__cse_config__`. Malformed JSON or a missing file both fall back to `{}`
 * (every field optional, so callers apply their own defaults) rather than failing the run. */
export async function fetchRunConfig(conductor: IRunnerPlugin): Promise<RunConfig> {
  const raw = await conductor.requestFile("/__cse_config__");
  if (!raw) return {};
  try {
    return JSON.parse(raw) as RunConfig;
  } catch {
    return {};
  }
}
