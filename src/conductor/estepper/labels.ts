/**
 * Stable display labels for the e-stepper's frames (`Global`, `E1`, `E2`, …) and heap objects
 * (`#1`, `#2`, …), shared by the step explanations and the serialized store so both always say the
 * same thing. A label is assigned the first time an object is shown and never changes afterwards.
 *
 * A frame without bindings (a call of a function with no parameters and no locals) is not drawn, as
 * in the course's environment diagrams, so it has no label of its own: it is labelled like the
 * nearest enclosing frame that is drawn (`Global`, usually). Looking names up from such a frame is
 * the same as from that frame, so the label says where a name is found. A frame's bindings are
 * all there from its creation (locals are unassigned until assigned), so the label never changes.
 */

import type { Closure } from "../../engines/cse/closure";
import type { Environment } from "../../engines/cse/environment";
import type { ListValue } from "../../engines/cse/stash";

export class Labels {
  private readonly frames = new WeakMap<Environment, string>();
  private readonly objects = new WeakMap<object, string>();
  private frameCount = 0;
  private objectCount = 0;

  constructor(private readonly programEnv: Environment) {
    this.frames.set(programEnv, "Global");
  }

  /** Whether a frame is drawn: the global frame always, and any other if it has bindings. */
  isShown(env: Environment): boolean {
    return env === this.programEnv || Object.keys(env.head).some(name => name !== "__program__");
  }

  /** The frame that stands for `env` in the drawing: itself, or its nearest drawn ancestor. */
  shownFrame(env: Environment): Environment {
    let shown = env;
    while (!this.isShown(shown) && shown.tail) shown = shown.tail;
    return shown;
  }

  frame(frame: Environment): string {
    const env = this.shownFrame(frame);
    let label = this.frames.get(env);
    if (label === undefined) {
      label = `E${++this.frameCount}`;
      this.frames.set(env, label);
    }
    return label;
  }

  /** The label of a heap object: a list, or a function object (keyed by its `Closure`). */
  object(obj: ListValue | Closure): string {
    let label = this.objects.get(obj);
    if (label === undefined) {
      label = `#${++this.objectCount}`;
      this.objects.set(obj, label);
    }
    return label;
  }

  /** The label of a frame if it already has one, without assigning one. */
  peekFrame(env: Environment): string | undefined {
    return this.frames.get(env);
  }

  /** The label of a heap object if it already has one, without assigning one. */
  peekObject(obj: object): string | undefined {
    return this.objects.get(obj);
  }
}
