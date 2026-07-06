/**
 * Drives the {@link reduceProgram reducer} to produce the ordered list of evaluation steps and
 * serializes them into the plain-JSON {@link SerializedStepperStep} protocol the host consumes.
 *
 * The step sequence mirrors Source's stepper: an initial "Start of evaluation" step, then for every
 * contraction a *before* step (the pre-reduction tree with the redex highlighted) and an *after*
 * step (the post-reduction tree with the result highlighted). The host's slider treats even-numbered
 * steps as "what evaluates next" (yellow) and odd-numbered steps as "the result" (green).
 */

import type {
  SerializedMarker,
  SerializedStepperNode,
  SerializedStepperStep,
} from "@sourceacademy/common-stepper";

import type { StmtNS } from "../../ast-types";
import { type StepNode, unparse } from "./ast";
import { isStepperValue, substituteBuiltinConstants } from "./builtins";
import { reduceProgram } from "./reduce";
import { translateProgram } from "./translate";

/** Default cap on the number of *contractions*; each contraction emits two steps. */
const DEFAULT_CONTRACTION_LIMIT = 500;

interface Marker {
  redex?: StepNode;
  redexType?: "beforeMarker" | "afterMarker";
  explanation?: string;
}

interface Step {
  ast: StepNode;
  markers?: Marker[];
}

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

function drive(prog: StepNode, contractionLimit: number): Step[] {
  const steps: Step[] = [{ ast: prog, markers: [{ explanation: "Start of evaluation" }] }];

  let current = prog;
  for (let i = 0; i < contractionLimit; i++) {
    let result: ReturnType<typeof reduceProgram>;
    try {
      result = reduceProgram(current);
    } catch (error) {
      // A runtime error during reduction (e.g. ZeroDivisionError): evaluation is stuck. Show the
      // error as the redex explanation on the current tree, then a terminal "Evaluation stuck" step,
      // mirroring Source (which ends a failed run with "Evaluation stuck" rather than "complete").
      const message = error instanceof Error ? error.message : String(error);
      steps.push({ ast: current, markers: [{ redexType: "beforeMarker", explanation: message }] });
      steps.push({ ast: current, markers: [{ explanation: "Evaluation stuck" }] });
      return steps;
    }
    if (result === null) {
      // No further contraction: the program is either a finished value ("Evaluation complete") or a
      // tree that cannot reduce yet is not a value ("Evaluation stuck"), exactly as Source reports.
      steps.push({
        ast: current,
        markers: [
          { explanation: isComplete(current) ? "Evaluation complete" : "Evaluation stuck" },
        ],
      });
      return steps;
    }

    steps.push({
      ast: current,
      markers: [
        {
          redex: result.preRedex,
          redexType: "beforeMarker",
          explanation: result.beforeExplanation,
        },
      ],
    });
    steps.push({
      // `postNode` (set by a contraction that discards a finished value — see its doc comment on
      // `ReduceResult`) is the tree to *display* here; `current` still advances via `result.node` below,
      // regardless, so the discarded statement is actually gone by the next contraction.
      ast: result.postNode ?? result.node,
      markers: [
        result.postRedex
          ? { redex: result.postRedex, redexType: "afterMarker", explanation: result.explanation }
          : { redexType: "afterMarker", explanation: result.explanation },
      ],
    });

    current = result.node;
    if (i === contractionLimit - 1) {
      steps.push({ ast: current, markers: [{ explanation: "Maximum number of steps exceeded" }] });
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
function serializeStep(step: Step): SerializedStepperStep {
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

  const ast = serializeNode(step.ast);

  const serializeMarker = (marker: Marker): SerializedMarker => {
    const out: SerializedMarker = {};
    if (marker.redex) {
      const redexId = ids.get(marker.redex);
      if (redexId !== undefined) out.redexId = redexId;
      out.redexNodeType = marker.redex.type;
    }
    if (marker.redexType !== undefined) out.redexType = marker.redexType;
    if (marker.explanation !== undefined) out.explanation = marker.explanation;
    return out;
  };

  return step.markers ? { ast, markers: step.markers.map(serializeMarker) } : { ast };
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
 */
export function getPythonSteps(
  fileInput: StmtNS.FileInput,
  stepLimit = 2 * DEFAULT_CONTRACTION_LIMIT,
): SerializedStepperStep[] {
  const contractionLimit = Math.max(1, Math.floor(stepLimit / 2));
  // Built-in constants (math_pi, …) are substituted in up front so they render as their value from
  // the first step, matching js-slang's stepper — see {@link substituteBuiltinConstants}.
  const program = substituteBuiltinConstants(translateProgram(fileInput));
  return drive(program, contractionLimit).map(serializeStep);
}

/**
 * Reduces a parsed Python file to normal form and returns the textual value of its final expression
 * (for the REPL). A completed Python program reduces all the way to an *empty* program — the reducer
 * discards the final expression's value like any other statement's (a Python statement yields no
 * program value; see `reduceProgram`) — so we remember the last top-level expression's text as the
 * program reduces, just before it is discarded, and echo that. The stepper's reduction *is* the
 * program's value in the substitution model, so no separate interpreter is needed.
 */
export function evaluatePython(fileInput: StmtNS.FileInput): string {
  let current = substituteBuiltinConstants(translateProgram(fileInput));
  let resultRepr = "";
  try {
    for (let i = 0; i < DEFAULT_CONTRACTION_LIMIT; i++) {
      // Remember the final expression's text before the next contraction discards it. A trailing
      // non-expression statement (e.g. an assignment) contributes no value, so `resultRepr` keeps the
      // last expression seen — or stays "" if the program never ends on one.
      const body = current.body as StepNode[];
      const last = body.length > 0 ? body[body.length - 1] : undefined;
      if (last?.type === "ExpressionStatement") {
        const expr = last.expression as StepNode;
        resultRepr = expr.type === "Literal" ? String(expr.raw ?? expr.value) : unparse(expr);
      }
      const result = reduceProgram(current);
      if (result === null) break;
      current = result.node;
    }
  } catch (error) {
    // A runtime error (e.g. ZeroDivisionError) surfaces in the REPL as its message; the stepper
    // separately shows an "Evaluation stuck" step. We never throw here, so a runtime fault is not
    // mistaken for a syntax/preprocessing error (which is what switches the host to the home tab).
    return error instanceof Error ? error.message : String(error);
  }

  return resultRepr;
}
