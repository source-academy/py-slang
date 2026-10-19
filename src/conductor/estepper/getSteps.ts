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
type Step = EStepperStep & { output?: string };

/**
 * Default cap on the number of steps. The step slider counts the steps taken, from 0 (the start) to
 * the last, and the number at its right end never exceeds the limit: a run is the start, two steps
 * per contraction and a last step, so that number is odd, and an even limit gives the odd number
 * below it.
 */
export const DEFAULT_STEP_LIMIT = 1000;

/**
 * How much the steps of a run may hold, in characters of their JSON (a step is a few KB, and the
 * heap holds several times that). A run that goes beyond ends with a step that says so, as it does
 * at the step limit, instead of crashing the browser tab that runs it (#611).
 */
export const MAX_STEPS_SIZE = 64_000_000;

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

export interface EStepperRun {
  steps: Step[];
  /** Everything the program printed. */
  output: string;
  /** The error that stopped evaluation, if any. */
  error?: string;
  /** Whether the step limit, or the limit on the size of the steps, was reached before the program finished. */
  truncated: boolean;
  /** What stopped a truncated run: the number of steps, or the space they use. */
  truncatedBy?: "steps" | "size";
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
  maxSize = MAX_STEPS_SIZE,
): Promise<EStepperRun> {
  const machine = await prepare(fileInput, code, chapter, requestInput);
  machine.maxUnreachable = unreachableLimit(stepLimit);
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
    size += JSON.stringify(step).length;
  };

  push(program, snapshotStore(machine, program), "", { explanation: "Start of evaluation" });

  // The number of steps that end a contraction: the JavaScript stack can run out in the middle of
  // one, in the machine or in drawing the term, which is nested as deep as the calls are.
  let complete = steps.length;
  try {
    const contractionLimit = Math.max(0, Math.floor((stepLimit - 1) / 2));
    for (let n = 0; ; n++) {
      complete = steps.length;
      if (n === contractionLimit || size > maxSize) {
        const bySize = n !== contractionLimit;
        push(program, snapshotStore(machine, program), machine.output, {
          explanation: bySize
            ? "Maximum size of the steps exceeded: they use too much memory"
            : "Maximum number of steps exceeded",
        });
        return {
          steps,
          output: machine.output,
          truncated: true,
          truncatedBy: bySize ? "size" : "steps",
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
  return (await runEStepper(fileInput, code, chapter, stepLimit, requestInput)).steps;
}
