/**
 * Drives the {@link reduceProgram reducer} to produce the ordered list of evaluation steps and
 * serializes them into the plain-JSON {@link SerializedStepperStep} protocol the host consumes.
 *
 * The step sequence mirrors Source's stepper: an initial "Start of evaluation" step, then for every
 * contraction a *before* step (the pre-reduction tree with the redex highlighted) and an *after*
 * step (the post-reduction tree with the result highlighted). The host's slider treats even-numbered
 * steps as "what evaluates next" (yellow) and odd-numbered steps as "the result" (green).
 *
 * Serialization also relabels a bare built-in/library-named `Identifier` (e.g. `print` or `llist_ref`
 * used as a value, not called) for display — a plain built-in becomes a `Builtin` node (py-slang#404); a
 * §2 pre-declared list-library function becomes its own real template, tagged as a mu-term, so it gets
 * the same "Function definition" hover popover a user-defined function does (py-slang#405). See
 * `ast.ts`'s `markBuiltins` for why doing this here, after reduction, rather than at translation time,
 * is what keeps it correct when the name is locally shadowed.
 */

import type {
  SerializedMarker,
  SerializedStepperNode,
  SerializedStepperStep,
} from "@sourceacademy/common-stepper";

import type { StmtNS } from "../../ast-types";
import { markBuiltins, type StepNode, unparse } from "./ast";
import { isStepperValue, resolveBuiltinDisplayValue, substituteBuiltinConstants } from "./builtins";
import type { StepperContext } from "./context";
import { resolveImports } from "./moduleInterop";
import { reduceProgram } from "./reduce";
import { translateProgram } from "./translate";

/** Default cap on the number of *contractions*; each contraction emits two steps. */
const DEFAULT_CONTRACTION_LIMIT = 500;

/** `stepLimit` (steps, the public unit — see `getPythonSteps`/`evaluatePython`) to a contraction
 * count (two steps per contraction). Shared by both entry points so they always agree on how far to
 * reduce a given `stepLimit` — see py-slang#191's CodeRabbit review: `evaluatePython` used to loop to
 * a hardcoded `DEFAULT_CONTRACTION_LIMIT` regardless of what `stepLimit` its sibling was actually
 * given, so a run configured with a *smaller* `stepLimit` could have the Stepper tab's own pass stop
 * before reaching an `input()` call the REPL-value pass still tried to reach — `InputRecorder.replaying`
 * would then fall back to a live request, prompting the student a second time for the same input. */
function contractionLimitFor(stepLimit: number): number {
  return Math.max(1, Math.floor(stepLimit / 2));
}

interface Marker {
  redex?: StepNode;
  redexType?: "beforeMarker" | "afterMarker";
  explanation?: string;
  /** Whether this marker's redex is a `breakpoint()` statement — see `serializeMarker`. */
  isBreakpoint?: boolean;
}

interface Step {
  ast: StepNode;
  markers?: Marker[];
  /** The program's cumulative output (everything `print` has written) up to and including this step. */
  output?: string;
}

/**
 * {@link SerializedStepperStep} widened with the `output` field. `output` was added to the shared
 * protocol type in `@sourceacademy/common-stepper` 0.0.2; until this package bumps its dependency to
 * that, we widen locally so the runner can still emit it. The field crosses the runner→host channel as
 * plain JSON regardless of the static type, and the host reads it from its own (already-updated)
 * protocol type. TODO: drop this alias once the `@sourceacademy/common-stepper` dependency is ≥ 0.0.2.
 */
type SerializedStep = SerializedStepperStep & { output?: string };

/**
 * Whether `prog` is a finished result rather than a tree stuck mid-reduction. A completed program is
 * empty — the reducer discards even the final expression's value (a Python statement yields no value;
 * see `reduceProgram`) — so an empty body is complete. A single leftover expression statement is
 * complete only if it is a value (defensive: such a value is normally already discarded), while a
 * leftover non-value (e.g. `5(3)`, `[1, 2] + [3]`, an unbound name) is stuck. Distinguishes the
 * terminal "Evaluation complete" from "Evaluation stuck".
 */
function isComplete(prog: StepNode): boolean {
  const body = prog.body as StepNode[];
  if (body.length === 0) return true;
  if (body.length === 1 && body[0].type === "ExpressionStatement") {
    return isStepperValue(body[0].expression as StepNode);
  }
  return false;
}

/** RuntimeSourceError (including GenericDataHandler's module-interface errors) is deliberately a
 * structural error rather than a native Error subclass. Preserve its formatted message when the
 * stepper catches it, instead of rendering the object as `[object Object]`. */
function errorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return String(error);
}

async function drive(
  prog: StepNode,
  contractionLimit: number,
  context: StepperContext,
): Promise<Step[]> {
  // The program's cumulative output so far. A `print(...)` contraction reports its text via
  // `result.output`; we append it *between* that contraction's before and after steps, so the text
  // first appears on the "Ran print" (after) step and persists on every step after it. Every step
  // carries the running total, so the host's output panel shows exactly what had been printed by that
  // point as the slider moves (empty "" before the first print).
  let output = "";
  const steps: Step[] = [];
  // Every step must carry the *current* running total, so pushing goes through this closure instead
  // of each call site restating `output` — a plain `steps.push` would silently omit it.
  const pushStep = (ast: StepNode, markers?: Marker[]): void => {
    steps.push({ ast, markers, output });
  };

  pushStep(prog, [{ explanation: "Start of evaluation" }]);

  // Shared with reduce.ts's applyPythonCallable (via `runContext`) so a module calling back into a
  // Python function (py-slang#423) draws from — and can exhaust — the same budget this loop's own
  // top-level contractions do, rather than looping unbounded entirely inside one contraction; see
  // StepperContext's `contractionBudget` doc comment.
  const budget = { remaining: contractionLimit };
  const runContext: StepperContext = { ...context, contractionBudget: budget };

  let current = prog;
  while (budget.remaining > 0) {
    budget.remaining--;
    let result: Awaited<ReturnType<typeof reduceProgram>>;
    try {
      result = await reduceProgram(current, runContext);
    } catch (error) {
      // A runtime error during reduction (e.g. ZeroDivisionError): evaluation is stuck. Show the
      // error as the redex explanation on the current tree, then a terminal "Evaluation stuck" step,
      // mirroring Source (which ends a failed run with "Evaluation stuck" rather than "complete").
      const message = errorMessage(error);
      pushStep(current, [{ redexType: "beforeMarker", explanation: message }]);
      pushStep(current, [{ explanation: "Evaluation stuck" }]);
      return steps;
    }
    if (result === null) {
      // No further contraction: the program is either a finished value ("Evaluation complete") or a
      // tree that cannot reduce yet is not a value ("Evaluation stuck"), exactly as Source reports.
      pushStep(current, [
        { explanation: isComplete(current) ? "Evaluation complete" : "Evaluation stuck" },
      ]);
      return steps;
    }

    pushStep(current, [
      {
        redex: result.preRedex,
        redexType: "beforeMarker",
        explanation: result.beforeExplanation,
        isBreakpoint: result.isBreakpoint,
      },
    ]);
    // Apply this contraction's output (only a `print` produces any) so the after step and everything
    // after it show it, while the before ("Running print") step above still shows the prior total.
    if (result.output !== undefined) output += result.output;
    // The after step's tree is always `result.node` — identical to the next iteration's `current`
    // (pushed above as its own before step) — see `ReduceResult.node`'s doc comment on this invariant.
    // `postRedex` only highlights something when the redex was replaced in place by a surviving value;
    // a contraction that discards its redex outright (see `ReduceResult.postRedex`'s doc comment)
    // leaves it unset, so the after step shows the tree with no highlight at all.
    pushStep(result.node, [
      result.postRedex
        ? { redex: result.postRedex, redexType: "afterMarker", explanation: result.explanation }
        : { redexType: "afterMarker", explanation: result.explanation },
    ]);

    current = result.node;
    if (budget.remaining === 0) {
      pushStep(current, [{ explanation: "Maximum number of steps exceeded" }]);
    }
  }

  return steps;
}

/* -------------------------------------------------------------------------- */
/*                               Serialization                                */
/* -------------------------------------------------------------------------- */

function isNode(value: unknown): value is StepNode {
  return (
    value !== null && typeof value === "object" && typeof (value as StepNode).type === "string"
  );
}

/**
 * Serializes one step into plain JSON, assigning every node a stable `nodeId` (unique within the
 * step) so markers can reference their redex by id — object identity does not survive the channel.
 * Cycle-safe via an on-path set (any node revisited while still an ancestor becomes a child-less
 * stub), guaranteeing a finite, structured-clone-able tree.
 */
function serializeStep(step: Step): SerializedStep {
  let counter = 0;
  const ids = new Map<StepNode, string>();
  const onPath = new Set<StepNode>();

  const idOf = (node: StepNode): string => {
    let id = ids.get(node);
    if (id === undefined) {
      id = `n${counter++}`;
      ids.set(node, id);
    }
    return id;
  };

  const serializeNode = (node: StepNode): SerializedStepperNode => {
    const nodeId = idOf(node);
    if (onPath.has(node)) return { type: node.type, nodeId };
    onPath.add(node);
    const out: SerializedStepperNode = { type: node.type, nodeId };
    for (const key of Object.keys(node)) {
      if (key === "type") continue;
      out[key] = serializeValue(node[key]);
    }
    onPath.delete(node);
    return out;
  };

  const serializeValue = (value: unknown): unknown => {
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(serializeValue);
    if (isNode(value)) return serializeNode(value);
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      out[key] = serializeValue((value as Record<string, unknown>)[key]);
    }
    return out;
  };

  // Relabel built-in/library-named Identifiers for display before assigning nodeIds, so a relabeled
  // node gets one like any other (see `ast.ts`'s `markBuiltins` for why this must happen per-step,
  // after reduction).
  const { ast: markedAst, correspondence } = markBuiltins(step.ast, resolveBuiltinDisplayValue);
  const ast = serializeNode(markedAst);

  const serializeMarker = (marker: Marker): SerializedMarker => {
    const out: SerializedMarker = {};
    if (marker.redex) {
      // `marker.redex` was captured against the *original* (pre-`markBuiltins`) tree; translate it
      // through `correspondence` first so a redex that itself got relabeled (e.g. `breakpoint()`'s own
      // callee — both the highlighted redex and a builtin) still resolves to the node actually present
      // in `ast` — see `markBuiltins`'s doc comment.
      const redex = correspondence.get(marker.redex) ?? marker.redex;
      const redexId = ids.get(redex);
      if (redexId !== undefined) out.redexId = redexId;
      // `redexNodeType` drives the host's breakpoint navigation (the double-arrow jumps to a marker
      // whose type is "DebuggerStatement"), so it belongs on the before marker only — an after marker
      // still carries `redexId`/`redexType` (so its redex is highlighted — e.g. a `breakpoint()`/`pass`
      // shown green one last time before it is discarded), but emitting `redexNodeType` there too would
      // make the double-arrow also stop on that post-reduction step (landing on "Evaluated breakpoint
      // statement", not just "Evaluating …"). A `breakpoint()` redex is never actually typed
      // "DebuggerStatement" (see `stepHead`'s `ExpressionStatement` case in reduce.ts — it is detected
      // by resolved identity, not a dedicated node type, so aliasing like `bp = breakpoint; bp()` still
      // matches), so `isBreakpoint` overrides what would otherwise be the redex's real node type.
      if (marker.redexType === "beforeMarker") {
        out.redexNodeType = marker.isBreakpoint ? "DebuggerStatement" : redex.type;
      }
    }
    if (marker.redexType !== undefined) out.redexType = marker.redexType;
    if (marker.explanation !== undefined) out.explanation = marker.explanation;
    return out;
  };

  const out: SerializedStep = step.markers
    ? { ast, markers: step.markers.map(serializeMarker) }
    : { ast };
  // Emit `output` only when non-empty; the host defaults an absent field to "" and always shows the
  // (possibly empty) output panel once code has run, so pre-print steps need not carry an empty string.
  if (step.output) out.output = step.output;
  return out;
}

/* -------------------------------------------------------------------------- */
/*                                  Entry points                              */
/* -------------------------------------------------------------------------- */

/**
 * Produces the serialized evaluation steps for a parsed Python file. This is what the
 * {@link ../stepper/PythonStepperRunnerPlugin runner plugin} returns to the host.
 *
 * @param fileInput The parsed Python program.
 * @param stepLimit Maximum number of *steps* (two per contraction); defaults to 1000.
 * @param context The stepper's bundled host capabilities (module resolution, `input()`) — see
 * `context.ts`. Defaults to `{}` (neither capability wired up — e.g. a test calling this directly);
 * a program that needs one it doesn't have simply degrades gracefully (an unresolved import throws a
 * clear `ModuleImportError`; an `input()` call stays "Evaluation stuck") exactly as if this parameter
 * didn't exist.
 */
export async function getPythonSteps(
  fileInput: StmtNS.FileInput,
  stepLimit = 2 * DEFAULT_CONTRACTION_LIMIT,
  context: StepperContext = {},
): Promise<SerializedStepperStep[]> {
  const contractionLimit = contractionLimitFor(stepLimit);
  // Built-in constants (math_pi, …) are substituted in up front so they render as their value from
  // the first step, matching js-slang's stepper — see {@link substituteBuiltinConstants}. Imported
  // names are only *resolved* up front, immediately after (a real module-loading round trip, done
  // once) — each one is *substituted in* later, as its own import statement's own step, not here (see
  // `resolveImports`'s doc comment, py-slang#417).
  const translated = substituteBuiltinConstants(translateProgram(fileInput));
  const program = await resolveImports(fileInput, context.evaluator, translated);
  return (await drive(program, contractionLimit, context)).map(serializeStep);
}

/**
 * Reduces a parsed Python file to normal form and returns the textual value of its final expression
 * (for the REPL). A completed Python program reduces all the way to an *empty* program — the reducer
 * discards the final expression's value like any other statement's (a Python statement yields no
 * program value; see `reduceProgram`) — so we remember the last top-level expression's text as the
 * program reduces, just before it is discarded, and echo that. The stepper's reduction *is* the
 * program's value in the substitution model, so no separate interpreter is needed.
 *
 * @param stepLimit Same meaning as `getPythonSteps`'s identical parameter, and — when re-deriving the
 * REPL's echoed value after `getPythonSteps` has already run for the same program, as
 * `PyStepperEvaluatorBase`'s `runChunk` does — it must be passed the *same* value that pass used.
 * Both entry points reduce the identical AST from the identical starting substitutions, so a
 * mismatched limit would let one pass stop before the other, which matters most for `input()`:
 * `InputRecorder.replaying` only has recorded answers for calls the Stepper tab's own pass actually
 * reached, so this pass reaching further would fall back to a live request and prompt the student a
 * second time for what should already be answered.
 * @param context See `getPythonSteps`'s identical parameter. When re-deriving the REPL's echoed
 * value after `getPythonSteps` has already run for the same program (as `PyStepperEvaluatorBase`'s
 * `runChunk` does), pass a `requestInput` that *replays* the same answers rather than asking the
 * student again — see `PyStepperEvaluator.ts`'s `InputRecorder`.
 */
export async function evaluatePython(
  fileInput: StmtNS.FileInput,
  stepLimit = 2 * DEFAULT_CONTRACTION_LIMIT,
  context: StepperContext = {},
): Promise<string> {
  const contractionLimit = contractionLimitFor(stepLimit);
  const translated = substituteBuiltinConstants(translateProgram(fileInput));
  // Import resolution is deliberately outside the try/catch below: a `ModuleImportError` (module not
  // found, a relative import, a name a module doesn't export) is a student-actionable, preprocessing-
  // shaped error — it should propagate to the caller exactly like a `preprocessPython` error does, not
  // be swallowed into the REPL's result text the way a mid-reduction runtime fault (e.g.
  // ZeroDivisionError) is below.
  let current = await resolveImports(fileInput, context.evaluator, translated);
  let resultRepr = "";
  // See `drive`'s identical budget — shared with reduce.ts's applyPythonCallable (py-slang#423) so a
  // non-terminating module callback can't loop unbounded here either.
  const budget = { remaining: contractionLimit };
  const runContext: StepperContext = { ...context, contractionBudget: budget };
  try {
    while (budget.remaining > 0) {
      budget.remaining--;
      // Remember the final expression's text before the next contraction discards it. A trailing
      // non-expression statement (e.g. an assignment) contributes no value, so `resultRepr` keeps the
      // last expression seen — or stays "" if the program never ends on one.
      const body = current.body as StepNode[];
      const last = body.length > 0 ? body[body.length - 1] : undefined;
      if (last?.type === "ExpressionStatement") {
        const expr = last.expression as StepNode;
        resultRepr = expr.type === "Literal" ? String(expr.raw ?? expr.value) : unparse(expr);
      }
      const result = await reduceProgram(current, runContext);
      if (result === null) break;
      current = result.node;
    }
  } catch (error) {
    // A runtime error (e.g. ZeroDivisionError) surfaces in the REPL as its message; the stepper
    // separately shows an "Evaluation stuck" step. We never throw here, so a runtime fault is not
    // mistaken for a syntax/preprocessing error (which is what switches the host to the home tab).
    return errorMessage(error);
  }

  return resultRepr;
}
