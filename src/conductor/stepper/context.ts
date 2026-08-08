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
   * The remaining contraction budget for the outer, *visible* step sequence, shared mutable state
   * rather than a plain number so every consumer sees the same live count. `getSteps.ts`'s
   * `drive`/`evaluatePython` own it — each creates one and decrements it once per top-level
   * contraction, exactly as their own `contractionLimit` loop bound already did before this field
   * existed. `reduce.ts`'s `applyPythonCallable` (a module calling back into a Python function,
   * py-slang#423) deliberately does *not* draw from this: it runs its own nested `reduceExpr` loop
   * to a value, entirely *inside* one outer contraction, and can legitimately need far more
   * contractions than any reasonable visible step count would ever show a student — e.g. `sound`'s
   * `play` sampling a student-authored wave function at 44.1kHz needs tens of thousands of callback
   * calls to render even one second of audio (py-slang#427). A genuinely non-terminating callback
   * (infinite recursion in a student's own callback body, say) is instead the host's problem to stop —
   * the evaluator runs inside its own Worker, and the frontend's existing "Stop" control kills that
   * Worker outright, which works regardless of what it's doing internally. Optional and absent-safe
   * like the other fields: a caller driving `reduceExpr`/`contractCall` directly, without going
   * through `drive`/`evaluatePython`, simply gets an unbounded top-level loop too, same as before this
   * field existed.
   */
  contractionBudget?: { remaining: number };
  /**
   * Text a `print`/`print_llist` contraction has written *during a module callback* (py-slang#423)
   * but hasn't been folded into `drive`'s own cumulative output yet — shared mutable state for the
   * same reason `contractionBudget` is: a nested `reduceExpr` loop inside `applyPythonCallable`
   * happens entirely *inside* one top-level contraction, so its own `print` calls never reach
   * `drive`'s loop the normal way (reading `ReduceResult.output` off that one top-level call) — that
   * top-level `ReduceResult` is the *module call's* own result, which never sets `output` itself.
   * `applyPythonCallable` appends here instead; `drive`/`evaluatePython` drain and clear it once per
   * top-level contraction, right alongside that contraction's own direct `output`. Optional and
   * absent-safe like `contractionBudget`: without a host wired up to accumulate output at all, a
   * callback's `print` output is simply not collected, same as before this field existed.
   */
  pendingOutput?: { text: string };
}
