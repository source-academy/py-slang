/**
 * Stable display labels for the e-stepper's frames (`Global`, `E1`, `E2`, …) and heap objects
 * (`#1`, `#2`, …), shared by the step explanations and the serialized store so both always say the
 * same thing. A label is assigned the first time an object is shown and never changes afterwards.
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

  frame(env: Environment): string {
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
