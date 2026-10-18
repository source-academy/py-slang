/**
 * Runs a program on the full e-stepper's machine and records a trace: for every contraction, the
 * explanation before it and after it, with the program, the frames and the heap objects as they
 * are. (The first slice of the engine has this text form of the trace only; the protocol of the
 * host's e-stepper tab follows. See docs/full-e-stepper.md.)
 */

import { Machine } from "./engine";
import { PyError } from "./errors";
import { clearStringCache } from "./operators";
import { stmtsText, valueText } from "./text";
import { UNASSIGNED, type Frame, type HeapObj } from "./values";

export interface FrameView {
  /** `Global`, `E1`, … */
  label: string;
  /** The function's name, or `global`. */
  name: string;
  /** The label of the frame that this one extends. */
  parent: string | null;
  bindings: { name: string; value: string }[];
}

export interface TraceStep {
  explanation: string;
  /** The program, as text; a call in progress is a `⟦E1: …⟧` block. */
  program: string;
  frames: FrameView[];
  /** The labelled heap objects: lists and function objects. */
  objects: { label: string; text: string }[];
}

export interface Trace {
  /** Step 0 is the start; every contraction then adds two steps: before it, and after it. */
  steps: TraceStep[];
  /** Everything that the program printed. */
  output: string;
  /** The error that stopped the program, if any: the name of the Python exception, and a message. */
  error: { kind: string; message: string } | null;
  /** Whether the step limit stopped the program. */
  truncated: boolean;
}

/** The error that a thrown value stands for (CPython reports every parse error as a SyntaxError). */
function errorOf(e: unknown): { kind: string; message: string } {
  if (e instanceof PyError) return { kind: e.kind, message: e.message };
  if (e instanceof SyntaxError) return { kind: "SyntaxError", message: e.message };
  // The JavaScript stack ran out: terms nested deeper than the engine can reduce, which is what
  // CPython calls a recursion error (it stops at depth 1000, usually before the engine does).
  if (e instanceof RangeError && /call stack/i.test(e.message)) {
    return { kind: "RecursionError", message: "maximum recursion depth exceeded" };
  }
  const message = e instanceof Error ? e.message : String(e);
  // The lexer's errors (`IndentationError`, …) are not SyntaxErrors in py-slang.
  const kind = e instanceof Error && /Indent/.test(e.name) ? "SyntaxError" : "InternalError";
  return { kind, message };
}

function snapshot(machine: Machine, explanation: string): TraceStep {
  const { store, labels } = machine;
  const view = (frame: Frame): FrameView => ({
    label: labels.frame(frame),
    name: frame.name,
    parent: frame.parent && frame.parent.kind !== "builtins" ? labels.frame(frame.parent) : null,
    bindings: [...frame.vars].map(([name, slot]) => ({
      name,
      // A function object is shown by its label here, so that a binding says what it holds.
      value:
        slot === UNASSIGNED
          ? "unassigned"
          : slot.type === "function"
            ? labels.object(slot.obj)
            : valueText(slot, labels),
    })),
  });
  const program = stmtsText(machine.program, labels);
  const frames = [store.module, ...store.calls].filter(f => labels.isShown(f)).map(view);
  const objectText = (obj: HeapObj): string =>
    obj.kind === "list"
      ? `[${obj.elements.map(e => valueText(e, labels)).join(", ")}]`
      : `${obj.src.kind === "FunctionDef" ? "def" : "lambda"} ${obj.name}(${obj.params.join(", ")})`;
  // Rendering the program and the frames has labelled the objects that they mention.
  const objects = labels.labelled.map(([obj, label]) => ({ label, text: objectText(obj) }));
  return { explanation, program, frames, objects };
}

function traceOf(code: string, stepLimit: number): Trace {
  let machine: Machine;
  try {
    machine = Machine.create(code);
  } catch (e) {
    return { steps: [], output: "", error: errorOf(e), truncated: false };
  }
  const steps: TraceStep[] = [snapshot(machine, "Start of evaluation")];
  let error: Trace["error"] = null;
  let truncated = false;
  for (let n = 0; ; n++) {
    if (n >= stepLimit) {
      truncated = true;
      break;
    }
    const before = snapshot(machine, "");
    let contraction;
    try {
      contraction = machine.step();
    } catch (e) {
      error = errorOf(e);
      steps.push({ ...before, explanation: `${error.kind}: ${error.message}` });
      break;
    }
    if (contraction === null) {
      steps.push(snapshot(machine, "Evaluation complete"));
      break;
    }
    steps.push({ ...before, explanation: contraction.before });
    steps.push(snapshot(machine, contraction.after));
  }
  return { steps, output: machine.output, error, truncated };
}

/** The trace as text: one block per step. */
export function formatTrace(trace: Trace): string {
  const blocks = trace.steps.map((step, i) => {
    const frames = step.frames.map(
      f =>
        `  ${f.label}${f.parent ? ` (extends ${f.parent})` : ""}: ${
          f.bindings.map(b => `${b.name} = ${b.value}`).join(", ") || "(empty)"
        }`,
    );
    const objects = step.objects.map(o => `  ${o.label} = ${o.text}`);
    return [`${i}: ${step.explanation}`, `  ${step.program}`, ...frames, ...objects].join("\n");
  });
  const tail = trace.error ? [`${trace.error.kind}: ${trace.error.message}`] : [];
  return [...blocks, ...tail].join("\n");
}

/**
 * Runs a program to its end (or the step limit) without recording a trace: what it printed and the
 * error that stopped it. For the tests that compare the engine with CPython.
 */
type Evaluation = { output: string; error: Trace["error"]; truncated: boolean; steps: number };

function evaluationOf(code: string, stepLimit: number): Evaluation {
  let machine: Machine;
  try {
    machine = Machine.create(code);
  } catch (e) {
    return { output: "", error: errorOf(e), truncated: false, steps: 0 };
  }
  for (let n = 0; ; n++) {
    if (n >= stepLimit) return { output: machine.output, error: null, truncated: true, steps: n };
    try {
      if (machine.step() === null)
        return { output: machine.output, error: null, truncated: false, steps: n };
    } catch (e) {
      return { output: machine.output, error: errorOf(e), truncated: false, steps: n };
    }
  }
}

/** Runs `code` and returns every step of its evaluation. */
export function runFullEStepper(code: string, stepLimit = 10_000): Trace {
  try {
    return traceOf(code, stepLimit);
  } finally {
    clearStringCache();
  }
}

/** Runs `code` to the end (or the step limit) and returns what it printed. */
export function evaluate(code: string, stepLimit = 1_000_000): Evaluation {
  try {
    return evaluationOf(code, stepLimit);
  } finally {
    clearStringCache();
  }
}
