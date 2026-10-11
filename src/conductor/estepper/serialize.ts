/**
 * Serializes the e-stepper's state into the `@sourceacademy/common-e-stepper` protocol: the program
 * as an estree-shaped AST (rendered by the host with Python's syntax profile, plus the protocol's
 * own `EnvBlock` and `Ref` nodes), and the store as frames and heap objects.
 *
 * Which frames and objects are shown: everything reachable from the program and the global frame,
 * plus every frame a call of the program created (greyed out as garbage once unreachable, so a
 * returned call's frame stays visible). Library internals — the prelude frame, builtins, and
 * library functions — are not drawn; a library function value is shown by its name, like a builtin.
 */

import type { CseSnapshot } from "@sourceacademy/common-cse-machine";
import type {
  EStepperFrame,
  EStepperHeapObject,
  EStepperValue,
  SerializedStepperNode,
} from "@sourceacademy/common-e-stepper";

import type { ExprNS, StmtNS } from "../../ast-types";
import type { Closure } from "../../engines/cse/closure";
import { type Environment, UNASSIGNED } from "../../engines/cse/environment";
import type { ListValue, Value } from "../../engines/cse/stash";
import { toPythonString } from "../../stdlib/utils";
import { serializeEnvChain, serializeValue } from "../plugins/PyCseMachinePlugin";
import type { Machine } from "./engine";
import { type Expr, type Stmt, translateExpr, translateStmts } from "./terms";
import { functionName } from "./text";

/* -------------------------------------------------------------------------- */
/*                                  Program                                   */
/* -------------------------------------------------------------------------- */

const TYPE_LABELS: Record<string, string> = {
  bigint: "int",
  number: "float",
  bool: "bool",
  string: "str",
  none: "None",
  complex: "complex",
};

/** Builds the serialized program tree, giving every node a `nodeId`; `ids` maps terms to them. */
export class ProgramSerializer {
  private counter = 0;
  readonly ids = new Map<Expr | Stmt, string>();

  constructor(private readonly machine: Machine) {}

  private node(
    term: Expr | Stmt | null,
    type: string,
    fields: Record<string, unknown>,
  ): SerializedStepperNode {
    const nodeId = `n${this.counter++}`;
    if (term) this.ids.set(term, nodeId);
    return { type, nodeId, ...fields };
  }

  program(stmts: Stmt[]): SerializedStepperNode {
    return this.node(null, "Program", { body: stmts.map(s => this.stmt(s)) });
  }

  value(v: Value, term: Expr | null = null): SerializedStepperNode {
    switch (v.type) {
      case "list":
        return this.node(term, "Ref", { objectId: this.machine.labels.object(v) });
      case "closure": {
        if (this.machine.isLibrary(v.closure)) {
          const name = functionName(v.closure) ?? "lambda";
          return this.node(term, "Builtin", { name, hoverText: `library function ${name}` });
        }
        return this.node(term, "Ref", { objectId: this.machine.labels.object(v.closure) });
      }
      case "builtin":
        return this.node(term, "Builtin", {
          name: v.name,
          hoverText: `built-in function ${v.name}`,
        });
      default: {
        const raw = toPythonString(v, true);
        const label = TYPE_LABELS[v.type] ?? v.type;
        // A negative number is `-` applied to a literal, not an atom: shown as `-1`, it would
        // otherwise lose its parentheses as a receiver, and `-1[0]` parses as `-(1[0])`.
        if ((v.type === "bigint" || v.type === "number") && raw.startsWith("-")) {
          return this.node(term, "UnaryExpression", {
            operator: "-",
            argument: this.node(null, "Literal", { value: null, raw: raw.slice(1), label }),
          });
        }
        return this.node(term, "Literal", { value: null, raw, label });
      }
    }
  }

  private ident(name: string): SerializedStepperNode {
    return this.node(null, "Identifier", { name });
  }

  private params(params: { lexeme: string; isStarred: boolean }[]): SerializedStepperNode[] {
    return params.map(p => this.ident((p.isStarred ? "*" : "") + p.lexeme));
  }

  private block(stmts: Stmt[]): SerializedStepperNode {
    return this.node(null, "BlockStatement", { body: stmts.map(s => this.stmt(s)) });
  }

  expr(e: Expr): SerializedStepperNode {
    switch (e.k) {
      case "val":
        return this.value(e.v, e);
      case "name":
        return this.node(e, "Identifier", { name: e.name });
      case "bin":
        return this.node(e, "BinaryExpression", {
          operator: e.opText,
          left: this.expr(e.left),
          right: this.expr(e.right),
        });
      case "bool":
        return this.node(e, "LogicalExpression", {
          operator: e.opText,
          left: this.expr(e.left),
          right: this.expr(e.right),
        });
      case "unary":
        return this.node(e, "UnaryExpression", {
          operator: e.opText === "not" ? "not " : e.opText,
          argument: this.expr(e.arg),
        });
      case "cond":
        return this.node(e, "ConditionalExpression", {
          test: this.expr(e.test),
          consequent: this.expr(e.cons),
          alternate: this.expr(e.alt),
        });
      case "lambda":
        return this.node(e, "ArrowFunctionExpression", {
          params: this.params(e.src.parameters),
          body: this.expr(translateExpr(e.src.body)),
        });
      case "call":
        return this.node(e, "CallExpression", {
          callee: this.expr(e.callee),
          arguments: e.args.map((a, i) =>
            e.starred[i]
              ? this.node(null, "SpreadElement", { argument: this.expr(a) })
              : this.expr(a),
          ),
        });
      case "list":
        return this.node(e, "ArrayExpression", { elements: e.elems.map(x => this.expr(x)) });
      case "sub":
        return this.node(e, "MemberExpression", {
          object: this.expr(e.obj),
          property: this.expr(e.index),
        });
      case "block":
        return this.node(e, "EnvBlock", {
          envId: this.machine.labels.frame(e.env),
          body: this.inBody(true, () =>
            Array.isArray(e.body) ? e.body.map(s => this.stmt(s)) : this.expr(e.body),
          ),
        });
      case "unsupported":
        return this.node(e, "Identifier", { name: `<${e.what}>` });
    }
  }

  stmt(s: Stmt): SerializedStepperNode {
    switch (s.k) {
      case "expr":
        return this.node(s, "ExpressionStatement", { expression: this.expr(s.e) });
      case "assign":
        return this.node(s, "VariableDeclaration", {
          kind: "",
          declarations: [
            this.node(null, "VariableDeclarator", {
              id: this.ident(s.name),
              init: this.expr(s.value),
            }),
          ],
        });
      case "subassign":
        return this.node(s, "AssignmentStatement", {
          target: this.node(null, "MemberExpression", {
            object: this.expr(s.obj),
            property: this.expr(s.index),
          }),
          value: this.expr(s.value),
        });
      case "def":
        return this.node(s, "FunctionDeclaration", {
          id: this.ident(s.src.name.lexeme),
          params: this.params(s.src.parameters),
          // A definition is shown as written, also inside the body of a call.
          body: this.inBody(false, () => this.block(translateStmts(s.src.body))),
        });
      case "return":
        return this.node(s, "ReturnStatement", { argument: s.e ? this.expr(s.e) : null });
      case "if":
        return this.node(s, "IfStatement", {
          test: this.expr(s.test),
          consequent: this.block(s.cons),
          alternate: s.alt ? this.block(s.alt) : null,
        });
      case "while":
        return this.node(s, "WhileStatement", {
          test: this.expr(s.test),
          body: this.block(translateStmts(s.src.body, this.inCall)),
        });
      case "forinit":
        return this.forNode(
          s,
          s.src,
          s.args.map(a => this.expr(a)),
        );
      case "for":
        return this.forNode(
          s,
          s.src,
          [s.cur, s.end, s.step].map(n => this.value({ type: "bigint", value: n })),
        );
      case "loop":
        return this.node(s, "LoopIteration", {
          statements: [...s.body.map(x => this.stmt(x)), this.stmt(s.next)],
        });
      case "break":
        return this.node(s, "BreakStatement", {});
      case "continue":
        return this.node(s, "ContinueStatement", {});
      case "pass":
        return this.node(s, "PassStatement", {});
      case "global":
        return this.node(s, "GlobalStatement", { names: s.names.join(", ") });
      case "nonlocal":
        return this.node(s, "NonlocalStatement", { names: s.names.join(", ") });
      case "unsupported-stmt":
        return this.node(s, "ExpressionStatement", { expression: this.ident(`<${s.what}>`) });
    }
  }

  private forNode(
    s: Stmt,
    src: StmtNS.For,
    rangeArgs: SerializedStepperNode[],
  ): SerializedStepperNode {
    return this.node(s, "ForStatement", {
      target: this.ident(src.target.lexeme),
      iter: this.node(null, "CallExpression", {
        callee: this.node(null, "Builtin", { name: "range", hoverText: "built-in function range" }),
        arguments: rangeArgs,
      }),
      body: this.block(translateStmts(src.body, this.inCall)),
    });
  }

  /**
   * Whether the statements being serialized are in the body of a call. The declarations in the
   * bodies of its loops are left out, as they are in the body itself (see `translateFunctionBody`).
   */
  private inCall = false;

  private inBody<T>(inCall: boolean, f: () => T): T {
    const before = this.inCall;
    this.inCall = inCall;
    try {
      return f();
    } finally {
      this.inCall = before;
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                               Active frame                                 */
/* -------------------------------------------------------------------------- */

/** The environment the next redex of `e` is evaluated in. */
function activeInExpr(machine: Machine, e: Expr, env: Environment): Environment {
  switch (e.k) {
    case "block":
      return Array.isArray(e.body)
        ? activeInList(machine, e.body, e.env)
        : activeInExpr(machine, e.body, e.env);
    case "bin":
      return activeInChildren(machine, [e.left, e.right], env);
    case "bool":
      return activeInChildren(machine, [e.left], env);
    case "unary":
      return activeInChildren(machine, [e.arg], env);
    case "cond":
      return activeInChildren(machine, [e.test], env);
    case "call":
      return activeInChildren(machine, [e.callee, ...e.args], env);
    case "list":
      return activeInChildren(machine, e.elems, env);
    case "sub":
      return activeInChildren(machine, [e.obj, e.index], env);
    default:
      return env;
  }
}

function activeInChildren(machine: Machine, children: Expr[], env: Environment): Environment {
  const next = children.find(c => !machine.isReady(c, env));
  return next ? activeInExpr(machine, next, env) : env;
}

export function activeInList(machine: Machine, list: Stmt[], env: Environment): Environment {
  if (list.length === 0) return env;
  const head = list[0];
  switch (head.k) {
    case "expr":
      return activeInExpr(machine, head.e, env);
    case "assign":
      return activeInExpr(machine, head.value, env);
    case "subassign":
      return activeInChildren(machine, [head.obj, head.index, head.value], env);
    case "return":
      return head.e ? activeInExpr(machine, head.e, env) : env;
    case "if":
    case "while":
      return activeInExpr(machine, head.test, env);
    case "forinit":
      return activeInChildren(machine, head.args, env);
    case "loop":
      return activeInList(machine, head.body, env);
    default:
      return env;
  }
}

/* -------------------------------------------------------------------------- */
/*                                    Store                                   */
/* -------------------------------------------------------------------------- */

type HeapObj = ListValue | Closure;

const isList = (obj: HeapObj): obj is ListValue => "type" in obj && obj.type === "list";
const asValue = (obj: HeapObj): Value => (isList(obj) ? obj : { type: "closure", closure: obj });

/** Collects the frames and heap objects a set of roots reaches (library internals excluded). */
class Reach {
  readonly frames = new Set<Environment>();
  readonly objects = new Set<HeapObj>();
  private readonly order: (Environment | HeapObj)[] = [];

  constructor(private readonly machine: Machine) {}

  /** Frames and objects in the order they were first reached. */
  get visited(): (Environment | HeapObj)[] {
    return this.order;
  }

  private isShownFrame(env: Environment): boolean {
    // The prelude and builtin frames are library internals.
    return env.name !== "prelude" && env.name !== "global";
  }

  frame(env: Environment | null | undefined): void {
    if (!env || !this.isShownFrame(env) || this.frames.has(env)) return;
    this.frames.add(env);
    this.order.push(env);
    for (const v of Object.values(env.head)) if (v !== UNASSIGNED) this.value(v);
    this.frame(env.tail);
  }

  value(v: Value): void {
    if (v.type === "list") {
      if (this.objects.has(v)) return;
      this.objects.add(v);
      this.order.push(v);
      for (const x of v.value) this.value(x);
    } else if (v.type === "closure") {
      if (this.machine.isLibrary(v.closure) || this.objects.has(v.closure)) return;
      this.objects.add(v.closure);
      this.order.push(v.closure);
      this.frame(v.closure.environment);
    }
  }

  expr(e: Expr): void {
    switch (e.k) {
      case "val":
        this.value(e.v);
        return;
      case "block":
        this.frame(e.env);
        if (Array.isArray(e.body)) this.stmts(e.body);
        else this.expr(e.body);
        return;
      case "bin":
      case "bool":
        this.expr(e.left);
        this.expr(e.right);
        return;
      case "unary":
        this.expr(e.arg);
        return;
      case "cond":
        this.expr(e.test);
        this.expr(e.cons);
        this.expr(e.alt);
        return;
      case "call":
        this.expr(e.callee);
        e.args.forEach(a => this.expr(a));
        return;
      case "list":
        e.elems.forEach(x => this.expr(x));
        return;
      case "sub":
        this.expr(e.obj);
        this.expr(e.index);
        return;
      default:
        return;
    }
  }

  stmts(list: Stmt[]): void {
    for (const s of list) {
      switch (s.k) {
        case "expr":
          this.expr(s.e);
          break;
        case "assign":
          this.expr(s.value);
          break;
        case "subassign":
          this.expr(s.obj);
          this.expr(s.index);
          this.expr(s.value);
          break;
        case "return":
          if (s.e) this.expr(s.e);
          break;
        case "if":
          this.expr(s.test);
          this.stmts(s.cons);
          if (s.alt) this.stmts(s.alt);
          break;
        case "while":
          this.expr(s.test);
          break;
        case "forinit":
          s.args.forEach(a => this.expr(a));
          break;
        case "loop":
          this.stmts(s.body);
          break;
        default:
          break;
      }
    }
  }
}

export interface StoreSnapshot {
  frames: EStepperFrame[];
  heap: EStepperHeapObject[];
  activeFrameId: string;
  /** The same store as a CSE machine snapshot (its `stepIndex` is set when the step is made). */
  cse: CseSnapshot;
}

export function snapshotStore(machine: Machine, program: Stmt[]): StoreSnapshot {
  const live = new Reach(machine);
  live.frame(machine.programEnv);
  live.stmts(program);

  // Also show every frame the program's calls created, and whatever only they reach.
  const all = new Reach(machine);
  all.frame(machine.programEnv);
  all.stmts(program);
  for (const env of machine.createdEnvs) all.frame(env);
  // And every object shown at an earlier step, as the CSE machine keeps showing objects that
  // have become garbage (e.g. the list `[None]` once `[None] * 3` has been evaluated).
  for (const obj of machine.shownObjects.keys()) all.value(asValue(obj));
  const active = activeInList(machine, program, machine.programEnv);
  for (const obj of all.objects) {
    if (!machine.shownObjects.has(obj)) {
      machine.shownObjects.set(obj, isList(obj) ? active : obj.environment);
    }
  }

  const labels = machine.labels;
  const valueOf = (v: Value | typeof UNASSIGNED): EStepperValue => {
    if (v === UNASSIGNED) return { kind: "unassigned" };
    switch (v.type) {
      case "list":
        return { kind: "ref", objectId: labels.object(v) };
      case "closure":
        return machine.isLibrary(v.closure)
          ? { kind: "builtin", name: functionName(v.closure) ?? "lambda" }
          : { kind: "ref", objectId: labels.object(v.closure) };
      case "builtin":
        return { kind: "builtin", name: v.name };
      default:
        return {
          kind: "primitive",
          display: toPythonString(v, true),
          label: TYPE_LABELS[v.type] ?? v.type,
        };
    }
  };
  const shownParent = (env: Environment): string | null =>
    env.tail && all.frames.has(env.tail) ? labels.frame(env.tail) : null;

  const frames: EStepperFrame[] = [];
  const heap: EStepperHeapObject[] = [];
  // Global first, then frames in creation order, then anything else in the order first reached.
  const frameOrder = [
    machine.programEnv,
    ...machine.createdEnvs,
    ...[...all.frames].filter(f => f !== machine.programEnv && !machine.createdEnvs.includes(f)),
  ];
  for (const env of frameOrder) {
    if (!all.frames.has(env)) continue;
    frames.push({
      id: labels.frame(env),
      name: env === machine.programEnv ? "global" : env.name,
      parentId: shownParent(env),
      bindings: Object.entries(env.head)
        .filter(([name]) => name !== "__program__")
        .map(([name, v]) => ({ name, value: valueOf(v) })),
      isGarbage: !live.frames.has(env),
    });
  }
  for (const item of all.visited) {
    if (!all.objects.has(item as HeapObj)) continue;
    const obj = item as HeapObj;
    if (isList(obj)) {
      heap.push({
        kind: "list",
        id: labels.object(obj),
        elements: obj.value.map(valueOf),
        isGarbage: !live.objects.has(obj),
      });
    } else {
      const closure = obj;
      const node = closure.node;
      heap.push({
        kind: "function",
        id: labels.object(closure),
        name: functionName(closure),
        params: node.parameters.map(p => (p.isStarred ? "*" : "") + p.lexeme),
        envId: labels.frame(closure.environment),
        source: sourceText(machine.code, node),
        isGarbage: !live.objects.has(closure),
      });
    }
  }
  // Heap objects in label order, so the drawing is stable from step to step.
  heap.sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));

  return {
    frames,
    heap,
    activeFrameId: labels.frame(active),
    cse: cseSnapshot(machine, program, 0),
  };
}

/** The source text of a function definition or lambda. */
function sourceText(code: string, node: StmtNS.FunctionDef | ExprNS.Lambda): string {
  const start = node.startToken.indexInSource;
  const end = node.endToken.indexInSource + node.endToken.lexeme.length;
  return start >= 0 && end <= code.length ? code.slice(start, end) : "";
}

/* -------------------------------------------------------------------------- */
/*                         The store as a CSE snapshot                        */
/* -------------------------------------------------------------------------- */

/** The frames of the function bodies under evaluation (the call stack) and the values in the
 * program, which keep frames alive the way the CSE machine's control and stash do. */
function programRoots(program: Stmt[]): { frames: Environment[]; values: Value[] } {
  const frames: Environment[] = [];
  const values: Value[] = [];
  const expr = (e: Expr): void => {
    switch (e.k) {
      case "val":
        values.push(e.v);
        return;
      case "block":
        frames.push(e.env);
        if (Array.isArray(e.body)) stmts(e.body);
        else expr(e.body);
        return;
      case "bin":
      case "bool":
        expr(e.left);
        expr(e.right);
        return;
      case "unary":
        expr(e.arg);
        return;
      case "cond":
        expr(e.test);
        expr(e.cons);
        expr(e.alt);
        return;
      case "call":
        expr(e.callee);
        e.args.forEach(expr);
        return;
      case "list":
        e.elems.forEach(expr);
        return;
      case "sub":
        expr(e.obj);
        expr(e.index);
        return;
      default:
        return;
    }
  };
  const stmts = (list: Stmt[]): void => {
    for (const st of list) {
      switch (st.k) {
        case "expr":
          expr(st.e);
          break;
        case "assign":
          expr(st.value);
          break;
        case "subassign":
          expr(st.obj);
          expr(st.index);
          expr(st.value);
          break;
        case "return":
          if (st.e) expr(st.e);
          break;
        case "if":
          expr(st.test);
          stmts(st.cons);
          if (st.alt) stmts(st.alt);
          break;
        case "while":
          expr(st.test);
          break;
        case "forinit":
          st.args.forEach(expr);
          break;
        case "loop":
          stmts(st.body);
          break;
        default:
          break;
      }
    }
  };
  stmts(program);
  return { frames, values };
}

/** The lists a binding of `env` holds, directly or inside the lists it holds. */
function heldLists(env: Environment): Set<ListValue> {
  const held = new Set<ListValue>();
  const visit = (v: Value): void => {
    if (v.type !== "list" || held.has(v)) return;
    held.add(v);
    v.value.forEach(visit);
  };
  for (const v of Object.values(env.head)) if (v !== UNASSIGNED) visit(v);
  return held;
}

/**
 * The step's store as a CSE machine snapshot (environments only; control and stash empty), made
 * with the CSE machine plugin's own serializer, so a host can draw it with its CSE machine
 * visualization exactly as the CSE Machine tab would. Frames that are no longer reachable are
 * left out, as in the CSE machine's snapshots; a host shows them as dead frames from earlier steps.
 */
export function cseSnapshot(machine: Machine, program: Stmt[], stepIndex: number): CseSnapshot {
  const { frames, values } = programRoots(program);
  const active = activeInList(machine, program, machine.programEnv);
  const callStack = [active, ...frames.reverse(), machine.programEnv];
  // Values and frames carry the e-stepper's labels of the objects (`#3`) and frames (`E2`) they
  // stand for, so a host can tell which object a reference in the program pane means, and which
  // frame an environment bracket does.
  const heldByFrame = new Map<Environment, Set<ListValue>>();
  const ids = {
    objects: (obj: object) => machine.labels.peekObject(obj),
    frames: (env: Environment) => machine.labels.peekFrame(env),
    // A list stays where it was first drawn (beside the frame it was made in), instead of moving
    // to whichever frame is active when it is passed to a function; only if that frame is drawn and
    // still holds the list. A host draws a list beside a frame that binds it, so a list that only
    // another frame holds (an argument that was never bound where it was made) would not be drawn.
    homes: (list: object) => {
      const home = machine.shownObjects.get(list as ListValue);
      if (home === undefined || !reached.frames.has(home)) return undefined;
      // Worked out once per frame for the snapshot, not for every list in it.
      let held = heldByFrame.get(home);
      if (!held) heldByFrame.set(home, (held = heldLists(home)));
      return held.has(list as ListValue) ? home : undefined;
    },
    code: machine.code,
  };
  const frameId = (env: Environment) => ids.frames(env) ?? env.id;

  // Objects shown at earlier steps that nothing here refers to any more: each goes into the heap
  // of the frame it belongs to (as anonymous heap objects), so a host draws it there, as dead.
  // A function object's frame is serialized too, through the values the chain starts from.
  const reached = new Reach(machine);
  for (const env of callStack) reached.frame(env);
  for (const v of values) reached.value(v);
  const unreferenced = [...machine.shownObjects.keys()].filter(obj => !reached.objects.has(obj));
  for (const obj of unreferenced) if (!isList(obj)) reached.frame(obj.environment);
  const garbage = unreferenced.filter(obj => !reached.objects.has(obj));
  const environments = serializeEnvChain(
    callStack,
    [...values, ...garbage.filter(obj => !isList(obj)).map(asValue)],
    [],
    active,
    ids,
  );
  for (const obj of garbage) {
    const home = machine.shownObjects.get(obj)!;
    const frame =
      environments.find(f => f.id === frameId(home)) ??
      environments.find(f => f.id === frameId(machine.programEnv));
    if (!frame) continue;
    (frame.heapObjects ??= []).push(serializeValue(asValue(obj), frame.id, ids));
  }
  return {
    stepIndex,
    // What the program still holds, as the CSE machine's control and stash would: a frame for
    // each function body under evaluation (an ENVIRONMENT instruction), and the values in the
    // program (results not yet used, e.g. a function just returned). A host does not draw them
    // here (environments only), but counts them as roots, so frames and objects they keep alive
    // are not shown as dead.
    control: frames.map(env => ({ displayText: "ENVIRONMENT", metadata: { envId: frameId(env) } })),
    stash: values.map(v => serializeValue(v, frameId(active), ids)),
    environments,
  };
}
