/**
 * Drives the e-stepper's {@link Machine} to produce the ordered evaluation steps, in the
 * `@sourceacademy/common-e-stepper` protocol.
 *
 * As in the substitution stepper (`../stepper/getSteps.ts`), there is a "Start of evaluation" step,
 * then for every contraction a *before* step (the program with the redex highlighted) and an *after*
 * step (the program after the contraction, with its result highlighted), and a final "Evaluation
 * complete" (or "Evaluation stuck") step. Each step also carries the store as it is at that moment:
 * the store is mutable, so it is snapshotted before and after every contraction.
 */

import type {
  EStepperLookup,
  EStepperStep,
  SerializedMarker,
} from "@sourceacademy/common-e-stepper";

import type { StmtNS } from "../../ast-types";
import { analyze } from "../../resolver/analysis";
import { VARIANT_GROUPS } from "../../runner";
import { RECURSION_ERROR_MESSAGE, isStackOverflow } from "../../errors/recursion";
import { type Contraction, Machine, type RequestInput } from "./engine";
import { browserHeapProbe, HEAP_FRACTION, type HeapProbe, MEMORY_CHECK_INTERVAL } from "./memory";
import {
  ProgramSerializer,
  snapshotStore,
  type StoreSnapshot,
  unreachableLimit,
} from "./serialize";
import { type Expr, type Stmt, translateStmts } from "./terms";

/**
 * {@link EStepperStep} with the stepper protocol's `output` field, which `@sourceacademy/common-stepper`
 * added in 0.0.2 (this package still depends on 0.0.1; see the identical widening in
 * `../stepper/getSteps.ts`), and the `cse` snapshot `@sourceacademy/common-e-stepper` adds in 0.0.2.
 * The fields cross the channel as plain JSON either way.
 */
export type Step = EStepperStep & { output?: string };

/**
 * Default cap on the number of steps. The step slider counts the steps taken, from 0 (the start) to
 * the last, and the number at its right end never exceeds the limit: a run is the start, two steps
 * per contraction and a last step, so that number is odd, and an even limit gives the odd number
 * below it.
 */
export const DEFAULT_STEP_LIMIT = 1000;

/**
 * Without a report of the host's heap (see `HeapProbe`), how much the steps of a run may hold, in
 * characters of their JSON (a step is a few KB, and the heap holds about ten times as much). A run
 * that goes beyond ends with a step that says so, as it does at the step limit, instead of crashing
 * the browser tab that runs it (#611).
 */
export const FALLBACK_STEPS_SIZE = 64_000_000;

/** What bounds the memory of a run. */
export interface MemoryLimits {
  /** The host's report on its heap (default: the browser's); `null`: none. */
  heap?: HeapProbe | null;
  /** Without a report: the size of the steps, in characters of JSON (default: `FALLBACK_STEPS_SIZE`). */
  maxSize?: number;
}

/** The text of an error for a step explanation. The CSE machine's runtime errors carry a
 * multi-line message (location, source line, hint, suggestion); the hint line (`XError: ...`) is
 * what a step needs. */
export function shortErrorMessage(error: unknown): string {
  if (isStackOverflow(error)) return RECURSION_ERROR_MESSAGE;
  const message =
    typeof error === "object" &&
    error !== null &&
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : String(error);
  const lines = message.split("\n").map(l => l.trim());
  return lines.find(l => /^[A-Za-z]*Error: /.test(l)) ?? lines.find(l => l !== "") ?? message;
}

/**
 * Ends `steps` (the last of which is whole) with the steps of a run that the JavaScript stack could
 * not go on with: the error as the explanation of a step, and "Evaluation stuck". The term that
 * could not be handled is not drawn: the last step stands in for it.
 */
function endWithRecursionError(steps: Step[]): void {
  const last = steps[steps.length - 1];
  const stuck = (explanation: string, redexType?: "beforeMarker"): Step => {
    const step: Step = {
      ...last,
      markers: [redexType ? { explanation, redexType } : { explanation }],
      cse: last.cse && { ...last.cse, stepIndex: steps.length },
    };
    delete step.lookups;
    return step;
  };
  steps.push(stuck(RECURSION_ERROR_MESSAGE, "beforeMarker"));
  steps.push(stuck("Evaluation stuck"));
}

/** How deeply objects and arrays are nested in a JSON value (a step has hundreds of thousands). */
function nestingDepth(root: unknown): number {
  if (root === null || typeof root !== "object") return 0;
  let deepest = 0;
  const nodes: object[] = [root];
  const depths: number[] = [0];
  while (nodes.length > 0) {
    const node = nodes.pop() as Record<string, unknown>;
    const depth = depths.pop() as number;
    if (depth > deepest) deepest = depth;
    const children = Array.isArray(node) ? node : Object.values(node);
    for (let i = 0; i < children.length; i++) {
      const child: unknown = children[i];
      if (child !== null && typeof child === "object") {
        nodes.push(child);
        depths.push(depth + 1);
      }
    }
  }
  return deepest;
}

/**
 * The steps, cut where the host could no longer send them. The steps go to the page in a message
 * (`postMessage`), whose copy of a term nested deeper than the stack can take fails with "Maximum
 * call stack size exceeded": the program of a step is as deep as the calls waiting for their result
 * (py-slang#610). The error would otherwise be the browser's, from the send. Instead the run ends
 * at the last step that can be sent, with a `RecursionError`.
 *
 * What the stack can take depends on the depth of the term alone, so it is enough to try the
 * deepest step (nearly always the only try: the steps of a run can be sent), and otherwise to look
 * for the deepest that can be sent by halving the depths. A step is tried as the message it will be
 * sent in. `post` posts a message as the send does; by default it posts to a `MessageChannel` whose
 * other end never reads, which serializes the message exactly as the send does and does not
 * deserialize it (a message nested too deep can overflow the stack natively when it is read). Where
 * there is none, the steps are sent as they are.
 */
export function sendableSteps<T extends Step>(steps: T[], post?: (message: unknown) => void): T[] {
  const channel = !post && typeof MessageChannel === "function" ? new MessageChannel() : undefined;
  const send = post ?? (channel && ((message: unknown) => channel.port1.postMessage(message)));
  if (!send || steps.length === 0) return steps;
  const unrelated = new Error("A failure of the copy that is not a stack overflow");
  try {
    const depths = steps.map(nestingDepth);
    const firstOfDepth = new Map<number, number>();
    depths.forEach((depth, i) => {
      if (!firstOfDepth.has(depth)) firstOfDepth.set(depth, i);
    });
    const distinct = [...firstOfDepth.keys()].sort((a, b) => a - b);
    const fits = (depth: number): boolean => {
      try {
        send({ type: "steps", steps: [steps[firstOfDepth.get(depth)!]] });
        return true;
      } catch (error) {
        if (isStackOverflow(error)) return false;
        throw unrelated; // (the send reports it)
      }
    };
    if (fits(distinct[distinct.length - 1])) return steps;
    // The deepest depth that fits (the shallowest does not fit, if none): `lo` fits, `hi` does not.
    let lo = -1;
    let hi = distinct.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (fits(distinct[mid])) lo = mid;
      else hi = mid;
    }
    if (lo < 0) return steps;
    const cut = depths.findIndex(depth => depth > distinct[lo]);
    // (When even the first step is too deep, the first that can be sent stands in for the run, as
    // its first step: its snapshot is numbered 0, as each step's snapshot is by its position.)
    let kept: T[];
    if (cut > 0) {
      kept = steps.slice(0, cut);
    } else {
      const stand = steps[depths.findIndex(d => d <= distinct[lo])];
      kept = [{ ...stand, cse: stand.cse && { ...stand.cse, stepIndex: 0 } }];
    }
    endWithRecursionError(kept);
    return kept;
  } catch (error) {
    if (error === unrelated) return steps;
    throw error;
  } finally {
    channel?.port1.close();
    channel?.port2.close();
  }
}

export interface EStepperRun {
  steps: Step[];
  /** Everything the program printed. */
  output: string;
  /** The error that stopped evaluation, if any. */
  error?: string;
  /** Whether the step limit, or the limit on the size of the steps, was reached before the program finished. */
  truncated: boolean;
  /** What stopped a truncated run: the number of steps, or the space they use. */
  truncatedBy?: "steps" | "memory";
}

/** A program the e-stepper refuses to run: the same name-resolution and sublanguage errors the
 * CSE evaluator reports before running a program. */
export class EStepperProgramError extends Error {
  constructor(readonly errors: Error[]) {
    super(errors.map(e => e.message).join("\n"));
    this.name = "EStepperProgramError";
  }
}

async function prepare(
  fileInput: StmtNS.FileInput,
  code: string,
  chapter: number,
  requestInput?: RequestInput,
): Promise<Machine> {
  const groups = VARIANT_GROUPS[chapter];
  if (!groups) throw new Error(`Invalid chapter: ${chapter}`);
  const machine = await Machine.create(code, chapter, groups, requestInput);
  // As the CSE evaluator: the prelude's names are known to the resolver like builtins.
  const preludeNames = Object.keys(machine.programEnv.tail?.head ?? {});
  const errors = analyze(fileInput, code, chapter, groups, preludeNames);
  if (errors.length > 0) throw new EStepperProgramError(errors);
  return machine;
}

/** Checks a program as the e-stepper would before running it; throws {@link EStepperProgramError}. */
export async function checkEStepperProgram(
  fileInput: StmtNS.FileInput,
  code: string,
  chapter: number,
): Promise<void> {
  await prepare(fileInput, code, chapter);
}

/**
 * Runs a program on the e-stepper. `requestInput` is how `input()` asks the user for a line; when
 * it is absent (the CLI, tests), `input()` stops evaluation with an error.
 */
export async function runEStepper(
  fileInput: StmtNS.FileInput,
  code: string,
  chapter: number,
  stepLimit = DEFAULT_STEP_LIMIT,
  requestInput?: RequestInput,
  limits: MemoryLimits = {},
): Promise<EStepperRun> {
  const machine = await prepare(fileInput, code, chapter, requestInput);
  machine.maxUnreachable = unreachableLimit(stepLimit);
  // The memory of the run: the heap against the limit the host reports, or else the size of the
  // steps (which costs a serialization of each, so it is not done when the host reports).
  const probe = limits.heap === undefined ? browserHeapProbe : limits.heap;
  const reports = probe !== null && probe() !== undefined;
  const maxSize = limits.maxSize ?? FALLBACK_STEPS_SIZE;
  const outOfMemory = (n: number): boolean => {
    if (!reports) return size > maxSize;
    if (n % MEMORY_CHECK_INTERVAL !== 0) return false;
    const heap = probe?.();
    return heap !== undefined && heap.used > HEAP_FRACTION * heap.limit;
  };
  let program: Stmt[] = translateStmts(fileInput.statements);
  const steps: Step[] = [];
  let size = 0;

  const push = (
    prog: Stmt[],
    store: StoreSnapshot,
    output: string,
    marker: {
      redex?: Expr | Stmt;
      redexType?: "beforeMarker" | "afterMarker";
      explanation: string;
      /** Whether the redex is a `breakpoint()` statement (see `Contraction.isBreakpoint`). */
      isBreakpoint?: boolean;
    },
    lookups: EStepperLookup[] = [],
  ): void => {
    const serializer = new ProgramSerializer(machine);
    const ast = serializer.program(prog);
    const m: SerializedMarker = { explanation: marker.explanation };
    if (marker.redexType) m.redexType = marker.redexType;
    if (marker.redex) {
      const id = serializer.ids.get(marker.redex);
      if (id !== undefined) m.redexId = id;
    }
    // As in the stepper, only the before step is a breakpoint for the host's navigation (the double
    // arrow stops on the step that evaluates the statement, not once more after it).
    if (marker.isBreakpoint && marker.redexType === "beforeMarker") {
      m.redexNodeType = "DebuggerStatement";
    }
    const step: Step = {
      ast,
      markers: [m],
      ...store,
      cse: { ...store.cse, stepIndex: steps.length },
    };
    if (output) step.output = output;
    if (lookups.length > 0) step.lookups = lookups;
    steps.push(step);
    if (!reports) size += JSON.stringify(step).length;
  };

  push(program, snapshotStore(machine, program), "", { explanation: "Start of evaluation" });

  // The number of steps that end a contraction: the JavaScript stack can run out in the middle of
  // one, in the machine or in drawing the term, which is nested as deep as the calls are.
  let complete = steps.length;
  try {
    const contractionLimit = Math.max(0, Math.floor((stepLimit - 1) / 2));
    for (let n = 0; ; n++) {
      complete = steps.length;
      if (n === contractionLimit || outOfMemory(n)) {
        const byMemory = n !== contractionLimit;
        push(program, snapshotStore(machine, program), machine.output, {
          explanation: byMemory
            ? "Maximum size of the steps exceeded: they use too much memory"
            : "Maximum number of steps exceeded",
        });
        return {
          steps,
          output: machine.output,
          truncated: true,
          truncatedBy: byMemory ? "memory" : "steps",
        };
      }
      const storeBefore = snapshotStore(machine, program);
      const outputBefore = machine.output;
      machine.lookups = [];
      let outcome: Awaited<ReturnType<Machine["stepList"]>>;
      try {
        outcome = await machine.stepList(program, machine.programEnv);
      } catch (error) {
        const message = shortErrorMessage(error);
        // Output printed during the failed contraction (e.g. by a library function) still counts.
        push(program, storeBefore, machine.output, {
          redexType: "beforeMarker",
          explanation: message,
        });
        push(program, snapshotStore(machine, program), machine.output, {
          explanation: "Evaluation stuck",
        });
        return { steps, output: machine.output, error: message, truncated: false };
      }
      if (outcome.kind !== "step") {
        push(program, storeBefore, outputBefore, {
          explanation: outcome.kind === "end" ? "Evaluation complete" : "Evaluation stuck",
        });
        return { steps, output: machine.output, truncated: false };
      }
      const lookups = machine.lookups.map(l => ({
        frameId: machine.labels.frame(l.env),
        name: l.name,
      }));
      const c: Contraction = outcome.c;
      push(
        program,
        storeBefore,
        outputBefore,
        {
          redex: c.pre,
          redexType: "beforeMarker",
          explanation: c.before,
          isBreakpoint: c.isBreakpoint,
        },
        lookups,
      );
      program = outcome.list;
      push(
        program,
        snapshotStore(machine, program),
        machine.output,
        { redex: c.post, redexType: "afterMarker", explanation: c.after },
        lookups,
      );
    }
  } catch (error) {
    if (!isStackOverflow(error)) throw error;
    // The last step that was made whole stands in for the term that could not be drawn.
    steps.length = complete;
    endWithRecursionError(steps);
    return { steps, output: machine.output, error: RECURSION_ERROR_MESSAGE, truncated: false };
  }
}

/** The steps for a program, for the runner plugin. */
export async function getEStepperSteps(
  fileInput: StmtNS.FileInput,
  code: string,
  chapter: number,
  stepLimit = DEFAULT_STEP_LIMIT,
  requestInput?: RequestInput,
): Promise<EStepperStep[]> {
  return sendableSteps(
    (await runEStepper(fileInput, code, chapter, stepLimit, requestInput)).steps,
  );
}
