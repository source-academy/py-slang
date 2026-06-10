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
} from '@sourceacademy/common-stepper';

import type { StmtNS } from '../../ast-types';
import { type StepNode, unparse } from './ast';
import { reduceProgram } from './reduce';
import { translateProgram } from './translate';

/** Default cap on the number of *contractions*; each contraction emits two steps. */
const DEFAULT_CONTRACTION_LIMIT = 500;

interface Marker {
  redex?: StepNode;
  redexType?: 'beforeMarker' | 'afterMarker';
  explanation?: string;
}

interface Step {
  ast: StepNode;
  markers?: Marker[];
}

function drive(prog: StepNode, contractionLimit: number): Step[] {
  const steps: Step[] = [{ ast: prog, markers: [{ explanation: 'Start of evaluation' }] }];

  let current = prog;
  for (let i = 0; i < contractionLimit; i++) {
    const result = reduceProgram(current);
    if (result === null) break;

    steps.push({
      ast: current,
      markers: [{ redex: result.preRedex, redexType: 'beforeMarker', explanation: result.explanation }],
    });
    steps.push({
      ast: result.node,
      markers: [
        result.postRedex
          ? { redex: result.postRedex, redexType: 'afterMarker', explanation: result.explanation }
          : { redexType: 'afterMarker', explanation: result.explanation },
      ],
    });

    current = result.node;
    if (i === contractionLimit - 1) {
      steps.push({ ast: current, markers: [{ explanation: 'Maximum number of steps exceeded' }] });
    }
  }

  return steps;
}

/* -------------------------------------------------------------------------- */
/*                               Serialization                                */
/* -------------------------------------------------------------------------- */

function isNode(value: unknown): value is StepNode {
  return value !== null && typeof value === 'object' && typeof (value as StepNode).type === 'string';
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
      if (key === 'type') continue;
      out[key] = serializeValue(node[key]);
    }
    onPath.delete(node);
    return out;
  };

  const serializeValue = (value: unknown): unknown => {
    if (value === null || typeof value !== 'object') return value;
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
  return drive(translateProgram(fileInput), contractionLimit).map(serializeStep);
}

/**
 * Reduces a parsed Python file to normal form and returns the textual value of its final expression
 * (for the REPL). The stepper's last reduction *is* the program's value in the substitution model,
 * so no separate interpreter is needed.
 */
export function evaluatePython(fileInput: StmtNS.FileInput): string {
  let current = translateProgram(fileInput);
  for (let i = 0; i < DEFAULT_CONTRACTION_LIMIT; i++) {
    const result = reduceProgram(current);
    if (result === null) break;
    current = result.node;
  }

  const body = current.body as StepNode[];
  if (body.length === 0) return '';
  const last = body[body.length - 1];
  if (last.type === 'ExpressionStatement') {
    const expr = last.expression as StepNode;
    return expr.type === 'Literal' ? String(expr.raw ?? expr.value) : unparse(expr);
  }
  return '';
}
