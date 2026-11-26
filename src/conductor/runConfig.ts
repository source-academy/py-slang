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

/**
 * The most steps that the Stepper records in a run, as a safety net and not a setting: the trace is
 * held in memory by the worker and then by the host, and its size grows faster than the number of
 * steps for a recursive program, whose expression grows with the recursion (measured for
 * `def f(n): return 0 if n == 0 else 1 + f(n - 1)` called with 100000: 1000 steps are 11 MB once
 * serialised, 2500 are 62 MB, 5000 are 239 MB and take four seconds). A student who wants to see less
 * presses Stop, and the steps so far are kept. The host's `stepLimit`, while it still sends one, is
 * a lower cap.
 */
export const STEPPER_STEP_CAP = 3000;

/**
 * The most steps that the E-Stepper records in a run, as a safety net and not a setting. Its steps
 * hold the store (frames and heap) besides the program, so they are larger than the Stepper's, and
 * their size grows faster than their number for a recursive program or one that builds a long list
 * (measured for `def f(n): return 0 if n == 0 else 1 + f(n - 1)` called with 100000: 1000 steps are
 * 26 MB once serialised, 2500 are 156 MB, and 5000 do not fit in a worker). A run is also ended by
 * the memory guard of `estepper/getSteps.ts` before that, where the host reports the heap. The
 * host's `stepLimit`, while it still sends one, is a lower cap.
 */
export const E_STEPPER_STEP_CAP = 2000;

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
