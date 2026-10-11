/**
 * The environment stepper's reduction engine.
 *
 * One call to {@link Machine.step} performs one contraction of the program and reports the redex and
 * an explanation, like the substitution stepper's `reduceProgram`. The difference is the model of
 * computation: names are looked up in environments instead of being substituted, a call to a
 * user-defined function creates a frame and steps to a {@link BlockExpr} (the function body
 * annotated with that frame), assignments change frames, and lists and function objects live in a
 * heap the program refers to. See docs/e-stepper.md for the rules.
 *
 * The store *is* the CSE machine's: frames are CSE `Environment`s (created with the CSE machine's
 * own `createEnvironment`, so arity errors, rest parameters and unassigned locals behave
 * identically), function objects are CSE `Closure`s, values are CSE `Value`s, and operators,
 * lookups, list access and the stdlib builtins are the CSE machine's own functions. This keeps the
 * e-stepper's results and errors in line with the CSE machine by construction.
 *
 * Functions from the library prelude (`map`, `stream_tail`, …) are applied atomically, in a single
 * step, by running them on the CSE machine itself: their bodies are library internals, not the
 * student's program.
 */

import { ExprNS, StmtNS } from "../../ast-types";
import {
  ConditionNotBoolError,
  IndexError,
  ListIndexTypeError,
  TypeError as PyTypeError,
  UnsupportedOperandTypeError,
  UserError,
} from "../../errors/errors";
import { Closure } from "../../engines/cse/closure";
import { Context } from "../../engines/cse/context";
import { Control } from "../../engines/cse/control";
import {
  createEnvironment,
  createProgramEnvironment,
  type Environment,
  pushEnvironment,
} from "../../engines/cse/environment";
import { handleRuntimeError } from "../../engines/cse/error";
import * as instrCreator from "../../engines/cse/instrCreator";
import { runCSEMachine } from "../../engines/cse/interpreter";
import {
  evaluateBinaryExpression,
  evaluateUnaryExpression,
  isFalsy,
} from "../../engines/cse/operators";
import { type ListValue, Stash, type Value } from "../../engines/cse/stash";
import {
  evaluateForIterator,
  evaluateListAssignment,
  getProgramEnvironment,
  pyDefineVariable,
  pyGetGlobalVariable,
  pyGetNonlocalVariable,
  pyGetVariable,
  pySetNonlocalVariable,
  scanForAssignments,
  scanForGlobalDeclarations,
  scanForNonlocalDeclarations,
} from "../../engines/cse/utils";
import { parse } from "../../parser";
import type { Group } from "../../stdlib/utils";
import { Labels } from "./labels";
import {
  type BlockExpr,
  type CallExpr,
  type Expr,
  type ForStmt,
  type LoopStmt,
  type Stmt,
  translateExpr,
  translateStmts,
  val,
} from "./terms";
import { describeValue, exprText, stmtHeadText, type TextContext, valueText } from "./text";

/** A binding read by a name lookup during a step. */
export interface Lookup {
  env: Environment;
  name: string;
  value: Value;
}

/** What a single contraction did, for the step's markers. */
export interface Contraction {
  /** The term that was contracted, in the tree before the step. */
  pre: Expr | Stmt;
  /** The term that replaced it, in the tree after the step (absent when it was removed). */
  post?: Expr | Stmt;
  /** Past tense, shown after the step. */
  after: string;
  /** Present continuous, shown before the step. */
  before: string;
  /** The name of the builtin this step applied, if it was one. */
  calledBuiltin?: string;
  /**
   * Whether the step is a `breakpoint()` statement: a call of the builtin `breakpoint` that is the
   * whole of a statement (as in the stepper; `x = breakpoint()` is not one). The host's breakpoint
   * navigation stops at such steps.
   */
  isBreakpoint?: boolean;
}

interface ExprStep {
  node: Expr;
  c: Contraction;
}

type ListOutcome =
  | { kind: "step"; list: Stmt[]; c: Contraction }
  | { kind: "return"; value: Value; c: Contraction }
  | { kind: "break" | "continue"; c: Contraction }
  | { kind: "end" };

/** Upper bound on CSE machine steps for one atomically applied library function. */
const ATOMIC_STEP_LIMIT = 1_000_000;

const NONE: Value = { type: "none" };

/**
 * The expression of the `return` statement a statement list is about to run, if it is a block (a
 * call that has just become the frame of the callee), looking into the loops the `return` is in.
 */
function tailBlock(list: Stmt[]): Expr | undefined {
  const head = list[0];
  if (head?.k === "return" && head.e?.k === "block") return head.e;
  if (head?.k === "loop") return tailBlock(head.body);
  return undefined;
}

/**
 * Whether a statement carries a gutter breakpoint (`hasBreakpoint`, set on its source by
 * `markBreakpoints`) that has not fired yet. Declarations (`global`, `nonlocal`) are not evaluated,
 * so they are never stops.
 */
function hasUnfiredBreakpoint(stmt: Stmt | undefined): boolean {
  if (!stmt || stmt.k === "global" || stmt.k === "nonlocal") return false;
  const { src, breakpointFired } = stmt as {
    src?: { hasBreakpoint?: boolean };
    breakpointFired?: boolean;
  };
  return !!src?.hasBreakpoint && !breakpointFired;
}

export class Machine {
  readonly context: Context;
  readonly programEnv: Environment;
  readonly labels: Labels;
  readonly text: TextContext;
  /** Frames created by calls the program makes (shown even once they are garbage). */
  readonly createdEnvs: Environment[] = [];
  /** Every heap object shown at some step so far (shown from then on, greyed out once garbage),
   * with the frame it belongs to: a function object's defining frame, or for a list, the frame
   * that was active when it was first shown. */
  readonly shownObjects = new Map<ListValue | Closure, Environment>();
  /** Everything the program has printed so far (written by `print` through the CSE streams). */
  private readonly printed: { text: string };
  /** Bindings read during the current contraction. */
  lookups: Lookup[] = [];

  private constructor(
    readonly code: string,
    readonly variant: number,
    context: Context,
    printed: { text: string },
  ) {
    this.context = context;
    this.printed = printed;
    this.programEnv = createProgramEnvironment(context, false);
    pushEnvironment(context, this.programEnv);
    this.labels = new Labels(this.programEnv);
    this.text = { labels: this.labels, isLibrary: c => this.isLibrary(c) };
  }

  /**
   * Sets up the store for a program: the chapter's builtins, and its library prelude evaluated (on
   * the CSE machine) into the prelude frame, exactly as the CSE evaluator does.
   */
  static async create(
    code: string,
    variant: number,
    groups: Group[],
    requestInput?: RequestInput,
  ): Promise<Machine> {
    const context = new Context();
    context.variant = variant;
    for (const group of groups) {
      for (const [name, value] of group.builtins) context.nativeStorage.builtins.set(name, value);
    }
    // The prelude prints nothing, but its output must not count as the program's anyway.
    const printed = { text: "" };
    context.streams = makeStreams(text => {
      printed.text += text;
    }, requestInput);
    const preludeText = groups.map(g => g.prelude ?? "").join("\n");
    if (preludeText.trim()) {
      const ast = parse(preludeText + "\n");
      await runCSEMachine(
        preludeText + "\n",
        context,
        new Control(ast),
        new Stash(),
        -1,
        1024,
        variant,
        true,
      );
    }
    printed.text = "";
    return new Machine(code, variant, context, printed);
  }

  get output(): string {
    return this.printed.text;
  }

  /** Whether a function object comes from the library prelude rather than the program. */
  isLibrary(closure: Closure): boolean {
    for (let env: Environment | null = closure.environment; env; env = env.tail) {
      if (env === this.programEnv) return false;
    }
    return true;
  }

  /* ------------------------------------------------------------------------ */
  /*                               Environments                               */
  /* ------------------------------------------------------------------------ */

  /** Makes `env` the CSE context's current environment (with its lexical chain behind it). */
  private enter(env: Environment): void {
    const chain: Environment[] = [];
    for (let e: Environment | null = env; e; e = e.tail) chain.push(e);
    this.context.runtime.environments = chain;
  }

  private lookup(e: Expr & { k: "name" }, env: Environment): Value {
    this.enter(env);
    const name = e.name;
    const isGlobal = env.closure?.globalVariables.has(name) ?? false;
    const isNonlocal = env.closure?.nonlocalVariables.has(name) ?? false;
    const value = isGlobal
      ? pyGetGlobalVariable(this.code, this.context, name, e.src)
      : isNonlocal
        ? pyGetNonlocalVariable(this.code, this.context, name, e.src)
        : pyGetVariable(this.code, this.context, name, e.src);
    // Record which frame the value came from (builtins come from no frame).
    const start = isGlobal ? this.programEnv : env;
    for (let f: Environment | null = start; f; f = f.tail) {
      if (Object.prototype.hasOwnProperty.call(f.head, name)) {
        if (this.isShownFrame(f)) this.lookups.push({ env: f, name, value });
        break;
      }
    }
    return value;
  }

  /**
   * Whether a term needs no reduction step of its own: a value, or the name of a builtin or library
   * function. Every other name is looked up in a step of its own.
   */
  isReady(e: Expr, env: Environment): boolean {
    return e.k === "val" || (e.k === "name" && this.isLibraryName(e, env));
  }

  /** The value of a ready term (looking up a library name). */
  private resolve(e: Expr, env: Environment): Value {
    if (e.k === "val") return e.v;
    if (e.k === "name") return this.lookup(e, env);
    throw new Error(`internal error: ${e.k} is not ready`);
  }

  private assign(name: string, value: Value, env: Environment, src: StmtNS.Stmt): Environment {
    this.enter(env);
    const isGlobal = env.closure?.globalVariables.has(name) ?? false;
    const isNonlocal = env.closure?.nonlocalVariables.has(name) ?? false;
    if (isGlobal) {
      const progEnv = getProgramEnvironment(this.context) ?? env;
      pyDefineVariable(this.context, name, value, progEnv);
      return progEnv;
    }
    if (isNonlocal) {
      pySetNonlocalVariable(this.code, this.context, name, value, src as unknown as ExprNS.Expr);
      for (let f: Environment | null = env.tail; f; f = f.tail) {
        if (Object.prototype.hasOwnProperty.call(f.head, name)) return f;
      }
      return env;
    }
    pyDefineVariable(this.context, name, value, env);
    return env;
  }

  /** Library frames (the prelude, and the builtins' global frame) are not drawn. */
  private isShownFrame(env: Environment): boolean {
    return env.name !== "prelude" && env.name !== "global";
  }

  /**
   * Whether a name refers to a builtin or library function. Such a name is not bound in any frame
   * the diagram shows, so it is looked up when used, without a step of its own.
   */
  private isLibraryName(e: Expr & { k: "name" }, env: Environment): boolean {
    const start = env.closure?.globalVariables.has(e.name) ? this.programEnv : env;
    for (let f: Environment | null = start; f; f = f.tail) {
      if (Object.prototype.hasOwnProperty.call(f.head, e.name)) return !this.isShownFrame(f);
    }
    return true;
  }

  private where(env: Environment): string {
    return env === this.programEnv ? "the global frame" : `frame ${this.labels.frame(env)}`;
  }

  private t(e: Expr): string {
    return exprText(e, this.text);
  }

  private v(value: Value): string {
    return valueText(value, this.text);
  }

  /* ------------------------------------------------------------------------ */
  /*                                Expressions                               */
  /* ------------------------------------------------------------------------ */

  /** Reduces the first of `children` that is not ready (Python evaluates left to right), or
   * returns null when every child is ready. */
  private async reduceChildren(
    children: Expr[],
    env: Environment,
  ): Promise<{ index: number; step: ExprStep } | null> {
    for (let i = 0; i < children.length; i++) {
      if (this.isReady(children[i], env)) continue;
      const step = await this.reduceExpr(children[i], env);
      if (step) return { index: i, step };
    }
    return null;
  }

  /** Reduces `e` by one step in environment `env`, or returns null if it is ready. */
  async reduceExpr(e: Expr, env: Environment): Promise<ExprStep | null> {
    switch (e.k) {
      case "val":
        return null;
      case "name": {
        if (this.isLibraryName(e, env)) return null;
        const value = this.lookup(e, env);
        const frame = this.lookups[this.lookups.length - 1].env;
        const node = val(value);
        return {
          node,
          c: {
            pre: e,
            post: node,
            before: `Looking up ${e.name}`,
            after: `Looked up ${e.name} in ${this.where(frame)}: ${describeValue(value, this.text)}`,
          },
        };
      }
      case "unsupported":
        throw new Error(`The environment stepper does not support ${e.what} expressions`);
      case "bin": {
        const r = await this.reduceChildren([e.left, e.right], env);
        if (r) {
          const node = r.index === 0 ? { ...e, left: r.step.node } : { ...e, right: r.step.node };
          return { node, c: r.step.c };
        }
        const left = this.resolve(e.left, env);
        const right = this.resolve(e.right, env);
        this.enter(env);
        const result = evaluateBinaryExpression(
          this.code,
          e.src as ExprNS.Binary,
          this.context,
          e.op,
          left,
          right,
          this.variant,
        );
        return this.contracted(e, val(result), "Evaluated", "Evaluating");
      }
      case "bool": {
        const r = await this.reduceChildren([e.left], env);
        if (r) return { node: { ...e, left: r.step.node }, c: r.step.c };
        const left = this.resolve(e.left, env);
        if (left.type !== "bool") {
          this.enter(env);
          handleRuntimeError(
            this.context,
            new UnsupportedOperandTypeError(this.code, e.src, this.context, left.type, "", e.op),
          );
        }
        const falsy = isFalsy(left);
        const takeLeft = e.opText === "and" ? falsy : !falsy;
        const node = takeLeft ? val(left) : e.right;
        return {
          node,
          c: {
            pre: e,
            post: node,
            before: `Evaluating ${this.t(e)}`,
            after: `Evaluated ${this.t({ ...e, left: val(left) })}: ${
              takeLeft ? "the left operand decides" : "continue with the right operand"
            }`,
          },
        };
      }
      case "unary": {
        const r = await this.reduceChildren([e.arg], env);
        if (r) return { node: { ...e, arg: r.step.node }, c: r.step.c };
        const arg = this.resolve(e.arg, env);
        this.enter(env);
        const result = evaluateUnaryExpression(this.code, e.src, this.context, e.op, arg);
        return this.contracted(e, val(result), "Evaluated", "Evaluating");
      }
      case "cond": {
        const r = await this.reduceChildren([e.test], env);
        if (r) return { node: { ...e, test: r.step.node }, c: r.step.c };
        const test = this.resolve(e.test, env);
        if (test.type !== "bool") {
          this.enter(env);
          handleRuntimeError(
            this.context,
            new ConditionNotBoolError(
              this.code,
              e.src.predicate,
              this.context,
              test.type,
              "conditional expression condition",
            ),
          );
        }
        const node = test.value ? e.cons : e.alt;
        return {
          node,
          c: {
            pre: e,
            post: node,
            before: "Evaluating conditional expression",
            after: `Evaluated conditional expression: condition is ${test.value ? "True" : "False"}`,
          },
        };
      }
      case "lambda": {
        const locals = scanForAssignments(e.src.body);
        for (const p of e.src.parameters) locals.add(p.lexeme);
        const closure = Closure.makeFromLambda(e.src, env, this.context, locals);
        const node = val({ type: "closure", closure });
        return {
          node,
          c: {
            pre: e,
            post: node,
            before: "Creating a function object",
            after: `Created function object ${this.labels.object(closure)} in ${this.where(env)}`,
          },
        };
      }
      case "list": {
        const r = await this.reduceChildren(e.elems, env);
        if (r) {
          const elems = e.elems.slice();
          elems[r.index] = r.step.node;
          return { node: { ...e, elems }, c: r.step.c };
        }
        const list: Value = { type: "list", value: e.elems.map(x => this.resolve(x, env)) };
        const node = val(list);
        return {
          node,
          c: {
            pre: e,
            post: node,
            before: "Creating a list",
            after: `Created list ${this.labels.object(list)}`,
          },
        };
      }
      case "sub": {
        const r = await this.reduceChildren([e.obj, e.index], env);
        if (r) {
          const node = r.index === 0 ? { ...e, obj: r.step.node } : { ...e, index: r.step.node };
          return { node, c: r.step.c };
        }
        const obj = this.resolve(e.obj, env);
        const index = this.resolve(e.index, env);
        this.enter(env);
        const result = this.listAccess(obj, index, e.src);
        return this.contracted(e, val(result), "Evaluated", "Evaluating");
      }
      case "call":
        return this.reduceCall(e, env);
      case "block":
        return this.reduceBlock(e);
    }
  }

  private contracted(e: Expr, node: Expr, after: string, before: string): ExprStep {
    const result = node.k === "val" ? `: ${this.v(node.v)}` : "";
    return {
      node,
      c: {
        pre: e,
        post: node,
        before: `${before} ${this.t(e)}`,
        after: `${after} ${this.t(e)}${result}`,
      },
    };
  }

  /** `obj[index]`, as the CSE machine's LIST_ACCESS instruction. */
  private listAccess(list: Value, index: Value, src: ExprNS.Expr): Value {
    if (list.type !== "list" && list.type !== "string") {
      handleRuntimeError(this.context, new PyTypeError(this.code, src, this.context, list.type));
    }
    if (index.type !== "bigint") {
      handleRuntimeError(this.context, new ListIndexTypeError(this.code, src, this.context));
    }
    const idx = Number(index.value);
    const codePoints = list.type === "string" ? [...list.value] : undefined;
    const length = codePoints ? codePoints.length : list.value.length;
    if (idx < -length || idx >= length) {
      handleRuntimeError(this.context, new IndexError(this.code, src, idx, length, false));
    }
    const wrapped = idx < 0 ? idx + length : idx;
    return list.type === "string"
      ? { type: "string", value: codePoints![wrapped] }
      : list.value[wrapped];
  }

  private async reduceCall(e: Expr & { k: "call" }, env: Environment): Promise<ExprStep | null> {
    const r = await this.reduceChildren([e.callee, ...e.args], env);
    if (r) {
      if (r.index === 0) return { node: { ...e, callee: r.step.node }, c: r.step.c };
      const args = e.args.slice();
      args[r.index - 1] = r.step.node;
      return { node: { ...e, args }, c: r.step.c };
    }

    const callee = this.resolve(e.callee, env);
    const rawArgs = e.args.map(a => this.resolve(a, env));
    this.enter(env);
    const args: Value[] = rawArgs.flatMap((a, i) => {
      if (!e.starred[i]) return [a];
      if (a.type === "list") return a.value;
      handleRuntimeError(this.context, new PyTypeError(this.code, e.src, this.context, a.type));
    });
    const display = this.t({ ...e, callee: val(callee), args: rawArgs.map(val) });

    if (callee.type === "closure" && !this.isLibrary(callee.closure)) {
      const closure = callee.closure;
      const frame = createEnvironment(this.code, this.context, closure, args, e.src);
      this.createdEnvs.push(frame);
      const node: BlockExpr = {
        k: "block",
        env: frame,
        fname: frame.name,
        body:
          closure.node.kind === "FunctionDef"
            ? translateStmts(closure.node.body)
            : translateExpr(closure.node.body),
      };
      const label = this.labels.frame(frame);
      const parent = closure.environment;
      return {
        node,
        c: {
          pre: e,
          post: node,
          before: `Calling ${display}`,
          after: `Called ${display}: new frame ${label} extends ${
            parent === this.programEnv ? "the global frame" : this.labels.frame(parent)
          }${declarationsNote(closure)}`,
        },
      };
    }

    // `apply_in_underlying_python(f, xs)` applies `f` to the elements of the linked list `xs`. The
    // CSE machine's builtin does that by pushing the application onto the machine's own stash and
    // control (it returns nothing), so here it is a step of its own: the call becomes `f(x1, …)`,
    // which then steps like any other call.
    if (
      callee.type === "builtin" &&
      callee.name === "apply_in_underlying_python" &&
      args.length === 2
    ) {
      const [func, argList] = args;
      const elements: Value[] = [];
      // As the builtin: follow the pairs; anything else ends the list.
      let current = argList;
      while (current && current.type === "list" && current.value.length === 2) {
        elements.push(current.value[0]);
        current = current.value[1];
      }
      const node: CallExpr = {
        k: "call",
        callee: val(func),
        args: elements.map(val),
        starred: elements.map(() => false),
        src: e.src,
      };
      return {
        node,
        c: {
          pre: e,
          post: node,
          before: `Running ${display}`,
          after: `Ran ${display}: apply the function to the ${elements.length === 1 ? "element" : "elements"} of the list`,
        },
      };
    }

    let result: Value;
    if (callee.type === "closure") {
      result = await this.applyAtomically(callee, args, e.src, env);
    } else if (callee.type === "builtin") {
      const out = await callee.func(args, this.code, e.src, this.context);
      if (out !== undefined && typeof out === "object" && "next" in out) {
        throw new Error("The environment stepper does not support module functions");
      }
      result = out ?? NONE;
    } else {
      handleRuntimeError(
        this.context,
        new PyTypeError(this.code, e.src, this.context, callee.type),
      );
    }
    const node = val(result);
    return {
      node,
      c: {
        pre: e,
        post: node,
        before: `Running ${display}`,
        after: `Ran ${display}`,
        calledBuiltin: callee.type === "builtin" ? callee.name : undefined,
      },
    };
  }

  /**
   * Applies a library function to completion in one step, on the CSE machine, in the same store.
   * Any function objects it calls back (e.g. the `f` in `map(f, xs)`) run there too.
   */
  private async applyAtomically(
    callee: Value,
    args: Value[],
    src: ExprNS.Call,
    env: Environment,
  ): Promise<Value> {
    const stash = new Stash();
    stash.push(callee);
    for (const a of args) stash.push(a);
    const control = new Control();
    // runCSEMachine looks for import statements in whatever is on top of the control (normally the
    // program); an application instruction has none.
    const app = Object.assign(instrCreator.appInstr(args.length, src), { statements: [] });
    control.push(app);
    this.enter(env);
    await runCSEMachine(
      this.code,
      this.context,
      control,
      stash,
      ATOMIC_STEP_LIMIT,
      1024,
      this.variant,
      false,
    );
    return stash.peek() ?? NONE;
  }

  /** The step of a tail call, which replaces the block `caller` of the calling frame. */
  private tailCalled(c: Contraction, caller: BlockExpr): Contraction {
    const left = this.labels.frame(caller.env);
    return {
      ...c,
      after: `${c.after}; a tail call, so ${left} is no longer needed in the program`,
    };
  }

  private async reduceBlock(e: BlockExpr): Promise<ExprStep | null> {
    if (!Array.isArray(e.body)) {
      const body = e.body;
      const step = await this.reduceExpr(body, e.env);
      // A lambda whose body is a call: a tail call, which the callee's frame replaces.
      if (step && body.k === "call" && step.node.k === "block") {
        return { node: step.node, c: this.tailCalled(step.c, e) };
      }
      if (step) return { node: { ...e, body: step.node }, c: step.c };
      const value = this.resolve(body, e.env);
      const node = val(value);
      return {
        node,
        c: {
          pre: e,
          post: node,
          before: `Returning ${this.v(value)} from ${this.labels.frame(e.env)}`,
          after: `Returned ${this.v(value)} from ${this.labels.frame(e.env)}`,
        },
      };
    }
    const outcome = await this.stepList(e.body, e.env);
    switch (outcome.kind) {
      case "step": {
        // `return f(x)` where `f(x)` just became the frame of the call: a tail call. The callee's
        // frame replaces this block, as nothing of it is needed any more.
        const tail = outcome.c.post && tailBlock(outcome.list) === outcome.c.post;
        if (tail && outcome.c.post?.k === "block") {
          return { node: outcome.c.post, c: this.tailCalled(outcome.c, e) };
        }
        return { node: { ...e, body: outcome.list }, c: outcome.c };
      }
      case "return": {
        const node = val(outcome.value);
        return {
          node,
          c: { ...outcome.c, pre: e, post: node },
        };
      }
      case "end": {
        const node = val(NONE);
        return {
          node,
          c: {
            pre: e,
            post: node,
            before: `Returning None from ${this.labels.frame(e.env)}`,
            after: `Reached the end of ${e.fname}: returned None from ${this.labels.frame(e.env)}`,
          },
        };
      }
      case "break":
      case "continue":
        throw new Error(`internal error: '${outcome.kind}' outside a loop`);
    }
  }

  /* ------------------------------------------------------------------------ */
  /*                                Statements                                */
  /* ------------------------------------------------------------------------ */

  private stmtStep(head: Stmt, rest: Stmt[], node: Stmt, c: Contraction): ListOutcome {
    return { kind: "step", list: [node, ...rest], c };
  }

  private removed(head: Stmt, rest: Stmt[], before: string, after: string): ListOutcome {
    return { kind: "step", list: rest, c: { pre: head, before, after } };
  }

  /**
   * Performs one step on a statement list evaluated in `env`. A statement flagged by
   * `markBreakpoints` (a gutter click, resolved to its closest enclosing statement; see
   * `../../breakpoints.ts`) is a breakpoint like a `breakpoint()` call, once: on the first step that
   * works on it.
   */
  async stepList(list: Stmt[], env: Environment): Promise<ListOutcome> {
    const outcome = await this.stepListOnce(list, env);
    if (outcome.kind === "end" || !hasUnfiredBreakpoint(list[0])) return outcome;
    const c: Contraction = { ...outcome.c, isBreakpoint: true };
    if (outcome.kind !== "step") return { ...outcome, c };
    // The statement may still be the first one, partly evaluated (or unfolded, a `while` into an
    // `if`): it has fired, and must not fire again for its next steps. Told by its source: a
    // statement that replaced it (the branch an `if` chose, the next statement) has its own, and
    // its own breakpoint.
    const next = outcome.list[0];
    const fired =
      next && (next as { src?: unknown }).src === (list[0] as { src?: unknown }).src
        ? [{ ...next, breakpointFired: true }, ...outcome.list.slice(1)]
        : outcome.list;
    return { ...outcome, list: fired, c };
  }

  private async stepListOnce(list: Stmt[], env: Environment): Promise<ListOutcome> {
    if (list.length === 0) return { kind: "end" };
    const head = list[0];
    const rest = list.slice(1);
    switch (head.k) {
      case "expr": {
        const step = await this.reduceExpr(head.e, env);
        if (step) {
          // A call of `breakpoint` that is the whole statement marks the step for the host's
          // breakpoint navigation.
          const c: Contraction =
            head.e === step.c.pre && step.c.calledBuiltin === "breakpoint"
              ? { ...step.c, isBreakpoint: true }
              : step.c;
          // A statement whose value is None (e.g. a call of print) has nothing left to show:
          // drop it in the same step.
          if (step.node.k === "val" && step.node.v.type === "none" && head.e === step.c.pre) {
            return { kind: "step", list: rest, c: { ...c, post: undefined } };
          }
          return this.stmtStep(head, rest, { ...head, e: step.node }, c);
        }
        const value = this.resolve(head.e, env);
        return this.removed(
          head,
          rest,
          "Finishing the expression statement",
          `Finished the expression statement: its value ${this.v(value)} is not used`,
        );
      }
      case "assign": {
        const step = await this.reduceExpr(head.value, env);
        if (step) return this.stmtStep(head, rest, { ...head, value: step.node }, step.c);
        const value = this.resolve(head.value, env);
        const frame = this.assign(head.name, value, env, head.src);
        return this.removed(
          head,
          rest,
          `Assigning ${head.name} = ${this.v(value)}`,
          `Assigned ${head.name} = ${this.v(value)} in ${this.where(frame)}`,
        );
      }
      case "subassign": {
        const r = await this.reduceChildren([head.obj, head.index, head.value], env);
        if (r) {
          const node =
            r.index === 0
              ? { ...head, obj: r.step.node }
              : r.index === 1
                ? { ...head, index: r.step.node }
                : { ...head, value: r.step.node };
          return this.stmtStep(head, rest, node, r.step.c);
        }
        const list = this.resolve(head.obj, env);
        const index = this.resolve(head.index, env);
        const value = this.resolve(head.value, env);
        this.enter(env);
        evaluateListAssignment(this.code, head.src, this.context, list, index, value);
        const text = stmtHeadText(head, this.text);
        return this.removed(head, rest, `Assigning ${text}`, `Assigned ${text}`);
      }
      case "def": {
        const src = head.src;
        const globals = scanForGlobalDeclarations(src.body);
        const nonlocals = scanForNonlocalDeclarations(src.body);
        const locals = scanForAssignments(src.body, globals, nonlocals);
        for (const p of src.parameters) locals.add(p.lexeme);
        const closure = Closure.makeFromFunctionDef(
          src,
          env,
          this.context,
          locals,
          globals,
          nonlocals,
        );
        this.enter(env);
        pyDefineVariable(this.context, src.name.lexeme, { type: "closure", closure });
        return this.removed(
          head,
          rest,
          `Defining ${src.name.lexeme}`,
          `Defined ${src.name.lexeme}: function object ${this.labels.object(closure)} in ${this.where(env)}`,
        );
      }
      case "return": {
        if (head.e === null) {
          return {
            kind: "return",
            value: NONE,
            c: { pre: head, before: "Returning None", after: "Returned None" },
          };
        }
        const step = await this.reduceExpr(head.e, env);
        if (step) return this.stmtStep(head, rest, { ...head, e: step.node }, step.c);
        const value = this.resolve(head.e, env);
        return {
          kind: "return",
          value,
          c: {
            pre: head,
            before: `Returning ${this.v(value)} from ${this.labels.frame(env)}`,
            after: `Returned ${this.v(value)} from ${this.labels.frame(env)}`,
          },
        };
      }
      case "if": {
        const step = await this.reduceExpr(head.test, env);
        if (step) return this.stmtStep(head, rest, { ...head, test: step.node }, step.c);
        const test = this.resolve(head.test, env);
        const isLoop = head.src instanceof StmtNS.While;
        if (test.type !== "bool") {
          this.enter(env);
          handleRuntimeError(
            this.context,
            isLoop
              ? new PyTypeError(this.code, head.src, this.context, test.type)
              : new ConditionNotBoolError(
                  this.code,
                  head.src.condition,
                  this.context,
                  test.type,
                  "if condition",
                ),
          );
        }
        const branch = test.value ? head.cons : (head.alt ?? []);
        const condition = `condition is ${test.value ? "True" : "False"}`;
        return {
          kind: "step",
          list: [...branch, ...rest],
          c: {
            pre: head,
            before: "Evaluating if statement",
            after: isLoop
              ? `Evaluated if statement: ${condition}, ${test.value ? "run the loop body" : "the loop ends"}`
              : `Evaluated if statement: ${condition}`,
          },
        };
      }
      case "while": {
        // The textbook rule: `while test: body` is `if test: (body; while test: body)`. The loop
        // stays in the program, in full, while its test is evaluated.
        const loop: LoopStmt = { k: "loop", body: translateStmts(head.src.body), next: head };
        const unfolded: Stmt = {
          k: "if",
          test: translateExpr(head.src.condition),
          cons: [loop],
          alt: null,
          src: head.src,
        };
        return this.stmtStep(head, rest, unfolded, {
          pre: head,
          post: unfolded,
          before: "Unfolding the while loop",
          after: "Unfolded the while loop into an if statement whose body ends with the loop",
        });
      }
      case "forinit": {
        const r = await this.reduceChildren(head.args, env);
        if (r) {
          const args = head.args.slice();
          args[r.index] = r.step.node;
          return this.stmtStep(head, rest, { ...head, args }, r.step.c);
        }
        // range()'s arity errors, exactly as the CSE machine reports them.
        this.enter(env);
        evaluateForIterator(this.code, this.context, head.src);
        const values = head.args.map(a => this.resolve(a, env));
        const bad = values.find(v => v.type !== "bigint");
        if (bad) {
          handleRuntimeError(
            this.context,
            new PyTypeError(this.code, head.src.iter, this.context, bad.type),
          );
        }
        const ints = values.map(v => (v as { value: bigint }).value);
        const [cur, end, step] =
          ints.length === 1 ? [0n, ints[0], 1n] : ints.length === 2 ? [ints[0], ints[1], 1n] : ints;
        if (step === 0n) {
          handleRuntimeError(
            this.context,
            new UserError("ValueError: range() arg 3 must not be zero", head.src.iter),
          );
        }
        const loop: ForStmt = { k: "for", cur, end, step, src: head.src };
        return {
          kind: "step",
          list: [loop, ...rest],
          c: {
            pre: head,
            post: loop,
            before: "Evaluating range",
            after: `Evaluated range: from ${cur} to ${end} in steps of ${step}`,
          },
        };
      }
      case "for": {
        const inRange = head.step > 0n ? head.cur < head.end : head.cur > head.end;
        if (!inRange) {
          return this.removed(
            head,
            rest,
            "Evaluating for statement",
            `Evaluated for statement: ${head.cur} is not in the range, the loop ends`,
          );
        }
        const target = head.src.target.lexeme;
        const loop: LoopStmt = {
          k: "loop",
          body: [
            {
              k: "assign",
              name: target,
              value: val({ type: "bigint", value: head.cur }),
              src: head.src,
            },
            ...translateStmts(head.src.body),
          ],
          next: { ...head, cur: head.cur + head.step },
        };
        return {
          kind: "step",
          list: [loop, ...rest],
          c: {
            pre: head,
            post: loop,
            before: "Evaluating for statement",
            after: `Evaluated for statement: run the body with ${target} = ${head.cur}`,
          },
        };
      }
      case "loop": {
        const inner = await this.stepList(head.body, env);
        switch (inner.kind) {
          case "step":
            return { kind: "step", list: [{ ...head, body: inner.list }, ...rest], c: inner.c };
          case "return":
            return inner;
          case "end":
            return {
              kind: "step",
              list: [head.next, ...rest],
              c: {
                pre: head,
                post: head.next,
                before: "Finishing the loop body",
                after: "Finished the loop body, back to the loop",
              },
            };
          case "break":
            return { kind: "step", list: rest, c: { ...inner.c, pre: head } };
          case "continue":
            return {
              kind: "step",
              list: [head.next, ...rest],
              c: { ...inner.c, pre: head, post: head.next },
            };
        }
        throw new Error("unreachable");
      }
      case "break":
        return {
          kind: "break",
          c: { pre: head, before: "Evaluating break", after: "Evaluated break: the loop ends" },
        };
      case "continue":
        return {
          kind: "continue",
          c: {
            pre: head,
            before: "Evaluating continue",
            after: "Evaluated continue: back to the loop",
          },
        };
      case "pass":
        return this.removed(head, rest, "Evaluating pass", "Evaluated pass");
      case "global":
      case "nonlocal": {
        // Declarations are not evaluated: when the function was defined, they decided which names
        // in its body are found (and assigned) in the global frame or an enclosing function's frame
        // (the closure's `globalVariables` and `nonlocalVariables`). So they stay in the program,
        // as part of its source, and evaluation goes on with the statements after them.
        const inner = await this.stepList(rest, env);
        return inner.kind === "step" ? { ...inner, list: [head, ...inner.list] } : inner;
      }
      case "unsupported-stmt":
        throw new Error(`The environment stepper does not support ${head.what} statements`);
    }
  }
}

/**
 * What a called function's `global` and `nonlocal` declarations decided, for the call step's
 * explanation: the new frame has no binding for the declared names (they are found, and assigned,
 * in the global frame or an enclosing function's frame). The declarations themselves are not
 * evaluated (see `stepList`).
 */
function declarationsNote(closure: Closure): string {
  const names = [
    ...[...closure.nonlocalVariables].map(name => `nonlocal ${name}`),
    ...[...closure.globalVariables].map(name => `global ${name}`),
  ];
  if (names.length === 0) return "";
  return `, without ${names.length === 1 ? "a binding" : "bindings"} for ${names.join(", ")}`;
}

/** Asks the user for a line of input (the host's `requestInput`), showing `prompt` if given. */
export type RequestInput = (prompt?: string) => Promise<string>;

/** The message `input()` stops with when there is no host to ask (e.g. the CLI). */
export const NO_INPUT_MESSAGE =
  "input() is not supported here: there is no way to ask for input (the e-stepper can ask only when run in the Source Academy)";

function makeStreams(onOutput: (text: string) => void, requestInput?: RequestInput) {
  const stdoutStream = new WritableStream<string>({ write: onOutput });
  const stderrStream = new WritableStream<unknown>({ write() {} });
  // As the CSE evaluator's `createInputStream`: each read asks the host for one line, with the
  // prompt `input()` set just before. Without a host, reading fails instead of returning "" (which
  // would let the program continue as if the user had entered an empty line).
  let prompt: string | undefined;
  const stdinStream = new ReadableStream<string>(
    {
      async pull(controller) {
        if (!requestInput) {
          controller.error(new Error(NO_INPUT_MESSAGE));
          return;
        }
        const ask = prompt;
        prompt = undefined;
        controller.enqueue(await requestInput(ask));
      },
    },
    // Pull only on an actual read, not eagerly at construction (see `createInputStream`).
    { highWaterMark: 0 },
  );
  return {
    initialised: true as const,
    stdout: { stream: stdoutStream, writer: stdoutStream.getWriter() },
    stderr: { stream: stderrStream, writer: stderrStream.getWriter() },
    stdin: {
      stream: stdinStream,
      reader: stdinStream.getReader(),
      setNextPrompt: (next?: string) => {
        prompt = next;
      },
    },
  };
}
