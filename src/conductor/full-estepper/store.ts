/**
 * The store of the full e-stepper: the frames, and the labels that the explanations use for them and
 * for the heap objects. Name lookup and assignment follow Python's scoping (LEGB, decided statically;
 * see scope.ts), not the CSE machine's.
 */

import { BUILTIN_NAMES } from "./builtins";
import { PyError } from "./errors";
import {
  UNASSIGNED,
  type Frame,
  type FunctionObj,
  type HeapObj,
  type PyValue,
  type Slot,
} from "./values";

/** Stable display labels: `Global`, `E1`, `E2`, … for frames, `#1`, `#2`, … for heap objects. */
export class Labels {
  private readonly frames = new Map<Frame, string>();
  private readonly objects = new Map<HeapObj, string>();
  private frameCount = 0;
  private objectCount = 0;

  constructor(private readonly module: Frame) {
    this.frames.set(module, "Global");
  }

  /** Whether a frame is drawn: the global frame always, and any other if it has bindings. */
  isShown(frame: Frame): boolean {
    return frame === this.module || frame.vars.size > 0;
  }

  /**
   * A frame without bindings (a call of a function with no parameters and no locals) is not drawn,
   * as in the course's environment diagrams; it is labelled like the nearest frame that is.
   */
  shownFrame(frame: Frame): Frame {
    let shown = frame;
    while (!this.isShown(shown) && shown.parent) shown = shown.parent;
    return shown;
  }

  frame(frame: Frame): string {
    const shown = this.shownFrame(frame);
    let label = this.frames.get(shown);
    if (label === undefined) {
      label = `E${++this.frameCount}`;
      this.frames.set(shown, label);
    }
    return label;
  }

  object(obj: HeapObj): string {
    let label = this.objects.get(obj);
    if (label === undefined) {
      label = `#${++this.objectCount}`;
      this.objects.set(obj, label);
    }
    return label;
  }

  /** The heap objects that have a label, in the order in which they got it. */
  get labelled(): [HeapObj, string][] {
    return [...this.objects];
  }
}

export interface Holder {
  frame: Frame;
  value: PyValue;
}

export class Store {
  readonly builtins: Frame;
  readonly module: Frame;
  readonly labels: Labels;
  /** The frames of the calls that the program has made, in the order of their creation. */
  readonly calls: Frame[] = [];
  private nextId = 1;

  constructor() {
    this.builtins = {
      id: this.nextId++,
      name: "built-ins",
      parent: null,
      vars: new Map(BUILTIN_NAMES.map(name => [name, { type: "builtin", name }])),
      scope: null,
      kind: "builtins",
    };
    this.module = {
      id: this.nextId++,
      name: "global",
      parent: this.builtins,
      vars: new Map(),
      scope: null,
      kind: "module",
    };
    this.labels = new Labels(this.module);
  }

  /** The frame of a call of `fn` with `args`: parameters bound, the other locals unassigned. */
  newCallFrame(fn: FunctionObj, args: PyValue[]): Frame {
    const vars = new Map<string, Slot>();
    fn.params.forEach((p, i) => vars.set(p, args[i]));
    for (const name of fn.scope.locals) if (!vars.has(name)) vars.set(name, UNASSIGNED);
    const frame: Frame = {
      id: this.nextId++,
      name: fn.name,
      parent: fn.closure,
      vars,
      scope: fn.scope,
      kind: "call",
    };
    this.calls.push(frame);
    return frame;
  }

  /** The nearest enclosing function frame of `from` (not `from` itself) that has `name` as a local. */
  private enclosingLocal(from: Frame, name: string): Frame | undefined {
    for (let f = from.parent; f; f = f.parent) {
      if (f.kind !== "call") continue;
      // A name that a function declares `global` is the module's, for the functions inside it too.
      if (f.scope?.globals.has(name)) return undefined;
      if (f.scope?.locals.has(name)) return f;
    }
    return undefined;
  }

  private lookupGlobal(name: string): Holder {
    for (const frame of [this.module, this.builtins]) {
      const slot = frame.vars.get(name);
      if (slot !== undefined && slot !== UNASSIGNED) return { frame, value: slot };
    }
    throw new PyError("NameError", `name '${name}' is not defined`);
  }

  private fromFreeVariable(frame: Frame, name: string): Holder {
    const slot = frame.vars.get(name);
    if (slot === undefined || slot === UNASSIGNED) {
      throw new PyError(
        "NameError",
        `cannot access free variable '${name}' where it is not associated with a value in enclosing scope`,
      );
    }
    return { frame, value: slot };
  }

  /** Looks `name` up as code running in `frame` does, and says which frame has it. */
  lookup(name: string, frame: Frame): Holder {
    if (frame.kind !== "call") return this.lookupGlobal(name);
    const scope = frame.scope as NonNullable<Frame["scope"]>;
    if (scope.globals.has(name)) return this.lookupGlobal(name);
    if (scope.nonlocals.has(name)) {
      const holder = this.enclosingLocal(frame, name);
      if (!holder) throw new PyError("SyntaxError", `no binding for nonlocal '${name}' found`);
      return this.fromFreeVariable(holder, name);
    }
    if (scope.locals.has(name)) {
      const slot = frame.vars.get(name);
      if (slot === undefined || slot === UNASSIGNED) {
        throw new PyError(
          "UnboundLocalError",
          `cannot access local variable '${name}' where it is not associated with a value`,
        );
      }
      return { frame, value: slot };
    }
    const holder = this.enclosingLocal(frame, name);
    return holder ? this.fromFreeVariable(holder, name) : this.lookupGlobal(name);
  }

  /** Binds `name` as code running in `frame` does, and says which frame now has the binding. */
  assign(name: string, value: PyValue, frame: Frame): Frame {
    let target = frame;
    if (frame.kind === "call") {
      const scope = frame.scope as NonNullable<Frame["scope"]>;
      if (scope.globals.has(name)) target = this.module;
      else if (scope.nonlocals.has(name)) {
        const holder = this.enclosingLocal(frame, name);
        if (!holder) throw new PyError("SyntaxError", `no binding for nonlocal '${name}' found`);
        target = holder;
      }
    }
    target.vars.set(name, value);
    return target;
  }
}
