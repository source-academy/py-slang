/**
 * The stepper's bundled "outside world" capabilities — everything a contraction might need to
 * `await` a real host round-trip for, threaded as a single parameter through `reduce.ts`'s
 * reduction core (`reduceExpr`/`stepHead`/`contractCall`/`reduceBlock`/`reduceProgram`) and
 * `getSteps.ts`'s entry points (`drive`/`getPythonSteps`/`evaluatePython`).
 *
 * `evaluator` and `requestInput` are optional and independently absent-safe: a contraction that
 * needs one but finds it `undefined` (no host wired up — e.g. a bare `getPythonSteps(fileInput)`
 * test call, or a program that never imports/reads input at all) simply stays irreducible, the same
 * honest "Evaluation stuck" degrade already documented for `input`/`time_time`/`random_random` in
 * `builtins.ts`. Bundled into one object (rather than positional parameters) so the reducer's
 * signatures don't grow a new parameter every time a new capability shows up — see py-slang#191.
 */

import type { IDataHandler } from "@sourceacademy/conductor/types";

export interface StepperContext {
  /** Conductor's module-interop handle, used to resolve/call `from X import Y` — see
   * `moduleInterop.ts`. */
  evaluator?: IDataHandler;
  /** Requests one line of input from the student, echoing `prompt` first — see `reduce.ts`'s
   * `contractCall`, `"input"` case. A real implementation is a genuine host round-trip (matching
   * `IRunnerPlugin.requestInput`'s own contract): one prompt in, one line back, in program order. */
  requestInput?: (prompt?: string) => Promise<string>;
  /**
   * The remaining contraction budget for the *entire* run, shared mutable state rather than a plain
   * number so every consumer sees the same live count. `getSteps.ts`'s `drive`/`evaluatePython` own
   * it — each creates one and decrements it once per top-level contraction, exactly as their own
   * `contractionLimit` loop bound already did before this field existed. `reduce.ts`'s
   * `applyPythonCallable` is the only other reader/writer: a module calling back into a Python
   * function (py-slang#423) drives its own nested `reduceExpr` loop to a value, entirely *inside* one
   * outer contraction, so without this the outer budget would never see — let alone stop — a
   * non-terminating callback (one that never returns control to the outer loop at all). Optional and
   * absent-safe like the other fields: a caller driving `reduceExpr`/`contractCall` directly, without
   * going through `drive`/`evaluatePython`, simply gets an unbounded callback loop, same as before
   * this field existed.
   */
  contractionBudget?: { remaining: number };
}
