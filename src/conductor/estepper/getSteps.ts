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
import { type Contraction, Machine, type RequestInput } from "./engine";
import { ProgramSerializer, snapshotStore, type StoreSnapshot } from "./serialize";
import { type Expr, type Stmt, translateStmts } from "./terms";

/**
 * {@link EStepperStep} with the stepper protocol's `output` field, which `@sourceacademy/common-stepper`
 * added in 0.0.2 (this package still depends on 0.0.1; see the identical widening in
 * `../stepper/getSteps.ts`), and the `cse` snapshot `@sourceacademy/common-e-stepper` adds in 0.0.2.
 * The fields cross the channel as plain JSON either way.
 */
type Step = EStepperStep & { output?: string };

/** Default cap on the number of steps (two per contraction). */
export const DEFAULT_STEP_LIMIT = 1000;

/** The text of an error for a step explanation. The CSE machine's runtime errors carry a
 * multi-line message (location, source line, hint, suggestion); the hint line (`XError: ...`) is
 * what a step needs. */
export function shortErrorMessage(error: unknown): string {
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
  /** Whether the step limit was reached before the program finished. */
  truncated: boolean;
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
): Promise<EStepperRun> {
  const machine = await prepare(fileInput, code, chapter, requestInput);
  let program: Stmt[] = translateStmts(fileInput.statements);
  const steps: Step[] = [];

  const push = (
    prog: Stmt[],
    store: StoreSnapshot,
    output: string,
    marker: {
      redex?: Expr | Stmt;
      redexType?: "beforeMarker" | "afterMarker";
      explanation: string;
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
    const step: Step = {
      ast,
      markers: [m],
      ...store,
      cse: { ...store.cse, stepIndex: steps.length },
    };
    if (output) step.output = output;
    if (lookups.length > 0) step.lookups = lookups;
    steps.push(step);
  };

  push(program, snapshotStore(machine, program), "", { explanation: "Start of evaluation" });

  const contractionLimit = Math.max(1, Math.floor(stepLimit / 2));
  for (let n = 0; ; n++) {
    if (n === contractionLimit) {
      push(program, snapshotStore(machine, program), machine.output, {
        explanation: "Maximum number of steps exceeded",
      });
      return { steps, output: machine.output, truncated: true };
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
      { redex: c.pre, redexType: "beforeMarker", explanation: c.before },
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
