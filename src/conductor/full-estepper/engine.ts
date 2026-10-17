/**
 * The reduction engine of the environment stepper for full Python ("full e-stepper").
 *
 * One call to {@link Machine.step} performs one contraction of the program and reports what it did,
 * like the e-stepper for Python §3/§4 (docs/e-stepper.md): names are looked up in frames, one lookup
 * to a step; a call of a function creates a frame and steps to a block, the function body annotated
 * with that frame; assignments change frames; lists and function objects live in a heap that the
 * program refers to; a `while` loop unfolds into the `if` of the textbook rule.
 *
 * Unlike that engine, this one does not run on the CSE machine's store: the values, operators,
 * scoping and built-ins are Python's own (see values.ts), so that the results are CPython's (the
 * tests compare them) and the engine can grow to the whole language (docs/full-e-stepper.md).
 */

import { parse } from "../../parser";
import { callBuiltin, type Output } from "./builtins";
import { PyError, UnsupportedError } from "./errors";
import { binaryOp, getItem, inplaceOp, iterAt, setItem, unaryOp } from "./operators";
import { checkProgram, scopeOf } from "./scope";
import { Store } from "./store";
import {
  translateExpr,
  translateFunctionBody,
  translateStmts,
  val,
  type Expr,
  type Stmt,
} from "./terms";
import { describeValue, exprText, stmtText, valueText } from "./text";
import {
  NONE,
  truthy,
  typeName,
  type Frame,
  type FunctionObj,
  type ListObj,
  type PyValue,
} from "./values";

/** What a contraction did: the explanations before and after it. */
export interface Contraction {
  /** Present continuous, shown before the step. */
  before: string;
  /** Past tense, shown after the step. */
  after: string;
}

interface ExprStep {
  node: Expr;
  c: Contraction;
}

type ListOutcome =
  | { kind: "step"; list: Stmt[]; c: Contraction }
  | { kind: "return"; value: PyValue; c: Contraction }
  | { kind: "break" | "continue"; c: Contraction }
  | { kind: "end" };

/** CPython's default limit on the depth of the stack of calls. */
const RECURSION_LIMIT = 1000;

/** `global` and `nonlocal` declarations are not evaluated; they stay in view in their list. */
const isDeclaration = (s: Stmt): boolean => s.k === "global" || s.k === "nonlocal";

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

function quotedNames(names: string[]): string {
  const quoted = names.map(n => `'${n}'`);
  if (quoted.length <= 2) return quoted.join(" and ");
  return `${quoted.slice(0, -1).join(", ")}, and ${quoted[quoted.length - 1]}`;
}

export class Machine {
  readonly store = new Store();
  /** Everything that the program has printed so far. */
  output = "";
  /** The program still to be evaluated, in the global frame. */
  program: Stmt[];

  private readonly out: Output = {
    write: (text: string) => {
      this.output += text;
    },
  };

  private constructor(program: Stmt[]) {
    this.program = program;
  }

  /** Parses and checks a program (CPython's compile-time errors come first). */
  static create(code: string): Machine {
    const ast = parse(code.endsWith("\n") ? code : `${code}\n`);
    checkProgram(ast.statements);
    return new Machine(translateStmts(ast.statements));
  }

  get labels() {
    return this.store.labels;
  }

  /** Performs one contraction of the program; null if the program is finished. */
  step(): Contraction | null {
    const outcome = this.stepList(this.program, this.store.module, 1);
    switch (outcome.kind) {
      case "step":
        this.program = outcome.list;
        return outcome.c;
      case "end":
        this.program = [];
        return null;
      default:
        throw new PyError("SyntaxError", `'${outcome.kind}' outside of its place`);
    }
  }

  /* ------------------------------------------------------------------------ */
  /*                                  Wording                                 */
  /* ------------------------------------------------------------------------ */

  private where(frame: Frame): string {
    if (frame.kind === "builtins") return "the built-ins";
    const label = this.labels.frame(frame);
    return label === "Global" ? "the global frame" : `frame ${label}`;
  }

  /** The environment a function object is created in, or a body runs in (as in the book, §3.2.1). */
  private inEnv(frame: Frame): string {
    const label = this.labels.frame(frame);
    return label === "Global" ? "the global environment" : `environment ${label}`;
  }

  private t(e: Expr): string {
    return exprText(e, this.labels);
  }

  private v(value: PyValue): string {
    return valueText(value, this.labels);
  }

  private truth(value: PyValue): string {
    const t = truthy(value) ? "True" : "False";
    return value.type === "bool" ? t : `${describeValue(value, this.labels)} counts as ${t}`;
  }

  private contracted(e: Expr, result: PyValue): ExprStep {
    return {
      node: val(result),
      c: { before: `Evaluating ${this.t(e)}`, after: `Evaluated ${this.t(e)}: ${this.v(result)}` },
    };
  }

  /* ------------------------------------------------------------------------ */
  /*                                Expressions                               */
  /* ------------------------------------------------------------------------ */

  /**
   * The value of an expression that is ready: a value, or the name of a built-in (which no drawn
   * frame binds, so it is not looked up in a step of its own, but in the step that uses it).
   */
  private valueOf(e: Expr, frame: Frame): PyValue {
    if (e.k === "val") return e.v;
    if (e.k === "name") return this.store.lookup(e.name, frame).value;
    throw new Error("the engine used an expression that is not a value yet");
  }

  /** Reduces the first of `children` that is not a value (Python evaluates left to right). */
  private reduceChildren(
    children: Expr[],
    frame: Frame,
    depth: number,
  ): { index: number; step: ExprStep } | null {
    for (let i = 0; i < children.length; i++) {
      const step = this.reduceExpr(children[i], frame, depth);
      if (step) return { index: i, step };
    }
    return null;
  }

  /** Reduces `e` by one step in `frame`, or returns null if it is a value. */
  private reduceExpr(e: Expr, frame: Frame, depth: number): ExprStep | null {
    switch (e.k) {
      case "val":
        return null;
      case "name": {
        const { frame: holder, value } = this.store.lookup(e.name, frame);
        if (holder.kind === "builtins") return null;
        return {
          node: val(value),
          c: {
            before: `Looking up ${e.name}`,
            after: `Looked up ${e.name} in ${this.where(holder)}: ${describeValue(value, this.labels)}`,
          },
        };
      }
      case "unsupported":
        throw new UnsupportedError(e.what);
      case "unary": {
        const r = this.reduceChildren([e.arg], frame, depth);
        if (r) return { node: { ...e, arg: r.step.node }, c: r.step.c };
        return this.contracted(e, unaryOp(e.op, this.valueOf(e.arg, frame)));
      }
      case "bin": {
        const r = this.reduceChildren([e.left, e.right], frame, depth);
        if (r) {
          const node = r.index === 0 ? { ...e, left: r.step.node } : { ...e, right: r.step.node };
          return { node, c: r.step.c };
        }
        return this.contracted(
          e,
          binaryOp(e.op, this.valueOf(e.left, frame), this.valueOf(e.right, frame)),
        );
      }
      case "bool": {
        const r = this.reduceChildren([e.left], frame, depth);
        if (r) return { node: { ...e, left: r.step.node }, c: r.step.c };
        const left = this.valueOf(e.left, frame);
        // `and` gives its left operand if that is falsy, `or` if it is truthy: Python does not
        // turn the operands into booleans.
        const decides = e.op === "and" ? !truthy(left) : truthy(left);
        return {
          node: decides ? e.left : e.right,
          c: {
            before: `Evaluating ${this.t(e)}`,
            after: `Evaluated ${this.t(e)}: ${
              decides ? "the left operand decides" : "continue with the right operand"
            }`,
          },
        };
      }
      case "cond": {
        const r = this.reduceChildren([e.test], frame, depth);
        if (r) return { node: { ...e, test: r.step.node }, c: r.step.c };
        const test = this.valueOf(e.test, frame);
        return {
          node: truthy(test) ? e.cons : e.alt,
          c: {
            before: "Evaluating conditional expression",
            after: `Evaluated conditional expression: condition is ${this.truth(test)}`,
          },
        };
      }
      case "lambda": {
        const fn: FunctionObj = {
          kind: "function",
          name: "lambda",
          params: e.src.parameters.map(p => p.lexeme),
          src: e.src,
          closure: frame,
          scope: scopeOf(e.src),
        };
        return {
          node: val({ type: "function", obj: fn }),
          c: {
            before: "Creating a function object",
            after: `Created function object ${this.labels.object(fn)} in ${this.inEnv(frame)}`,
          },
        };
      }
      case "list": {
        const r = this.reduceChildren(e.elems, frame, depth);
        if (r) {
          const elems = e.elems.slice();
          elems[r.index] = r.step.node;
          return { node: { ...e, elems }, c: r.step.c };
        }
        const obj: ListObj = { kind: "list", elements: e.elems.map(x => this.valueOf(x, frame)) };
        return {
          node: val({ type: "list", obj }),
          c: { before: "Creating a list", after: `Created list ${this.labels.object(obj)}` },
        };
      }
      case "sub": {
        const r = this.reduceChildren([e.obj, e.index], frame, depth);
        if (r) {
          const node = r.index === 0 ? { ...e, obj: r.step.node } : { ...e, index: r.step.node };
          return { node, c: r.step.c };
        }
        return this.contracted(
          e,
          getItem(this.valueOf(e.obj, frame), this.valueOf(e.index, frame)),
        );
      }
      case "call":
        return this.reduceCall(e, frame, depth);
      case "block":
        return this.reduceBlock(e, depth);
    }
  }

  private reduceCall(e: Extract<Expr, { k: "call" }>, frame: Frame, depth: number): ExprStep {
    const parts = [e.callee, ...e.args];
    const r = this.reduceChildren(parts, frame, depth);
    if (r) {
      if (r.index === 0) return { node: { ...e, callee: r.step.node }, c: r.step.c };
      const args = e.args.slice();
      args[r.index - 1] = r.step.node;
      return { node: { ...e, args }, c: r.step.c };
    }
    const callee = this.valueOf(e.callee, frame);
    const args = e.args.map(a => this.valueOf(a, frame));
    const display = this.t(e);

    if (callee.type === "builtin") {
      const result = callBuiltin(callee.name, args, this.out);
      return {
        node: val(result),
        c: {
          before: `Calling ${display}`,
          after: `Called ${display}: ${describeValue(result, this.labels)}`,
        },
      };
    }
    if (callee.type !== "function") {
      throw new PyError("TypeError", `'${typeName(callee)}' object is not callable`);
    }

    const fn = callee.obj;
    this.checkArity(fn, args.length);
    if (depth >= RECURSION_LIMIT) {
      throw new PyError("RecursionError", "maximum recursion depth exceeded");
    }
    const callFrame = this.store.newCallFrame(fn, args);
    const node: Expr = {
      k: "block",
      frame: callFrame,
      fname: fn.name,
      body: translateFunctionBody(fn.src),
    };
    // A frame without bindings is not drawn: the body then runs in the frame that it extends.
    const after = this.labels.isShown(callFrame)
      ? `new environment ${this.labels.frame(callFrame)}, whose enclosing environment is ${
          fn.closure === this.store.module
            ? "the global environment"
            : this.labels.frame(fn.closure)
        }`
      : `the new frame would have no bindings, so the body runs in ${this.inEnv(fn.closure)}`;
    return { node, c: { before: `Calling ${display}`, after: `Called ${display}: ${after}` } };
  }

  private checkArity(fn: FunctionObj, given: number): void {
    const name = fn.src.kind === "FunctionDef" ? fn.name : "<lambda>";
    const expected = fn.params.length;
    if (given > expected) {
      throw new PyError(
        "TypeError",
        `${name}() takes ${plural(expected, "positional argument")} but ${given} ${
          given === 1 ? "was" : "were"
        } given`,
      );
    }
    if (given < expected) {
      const missing = fn.params.slice(given);
      throw new PyError(
        "TypeError",
        `${name}() missing ${plural(missing.length, "required positional argument")}: ${quotedNames(missing)}`,
      );
    }
  }

  private reduceBlock(e: Extract<Expr, { k: "block" }>, depth: number): ExprStep {
    const outcome = this.stepList(e.body, e.frame, depth + 1);
    switch (outcome.kind) {
      case "step":
        return { node: { ...e, body: outcome.list }, c: outcome.c };
      case "return":
        return { node: val(outcome.value), c: outcome.c };
      case "end": {
        const label = this.labels.frame(e.frame);
        return {
          node: val(NONE),
          c: {
            before: `Returning None from ${label}`,
            after: `Reached the end of ${e.fname}: returned None from ${label}`,
          },
        };
      }
      default:
        throw new PyError("SyntaxError", `'${outcome.kind}' outside loop`);
    }
  }

  /* ------------------------------------------------------------------------ */
  /*                                Statements                                */
  /* ------------------------------------------------------------------------ */

  private stmtStep(rest: Stmt[], node: Stmt, c: Contraction): ListOutcome {
    return { kind: "step", list: [node, ...rest], c };
  }

  private removed(rest: Stmt[], before: string, after: string): ListOutcome {
    return { kind: "step", list: rest, c: { before, after } };
  }

  /** Performs one step on a statement list evaluated in `frame`. */
  private stepList(list: Stmt[], frame: Frame, depth: number): ListOutcome {
    let skip = 0;
    while (skip < list.length && isDeclaration(list[skip])) skip++;
    if (skip === list.length) return { kind: "end" };
    const outcome = this.stepStatement(list.slice(skip), frame, depth);
    if (skip === 0 || outcome.kind !== "step") return outcome;
    return { ...outcome, list: [...list.slice(0, skip), ...outcome.list] };
  }

  private stepStatement(list: Stmt[], frame: Frame, depth: number): ListOutcome {
    const head = list[0];
    const rest = list.slice(1);
    switch (head.k) {
      case "expr": {
        const step = this.reduceExpr(head.e, frame, depth);
        if (step) {
          // A statement whose value is None (a call of print) has nothing left to show: drop it in
          // the same step.
          if (head.e.k === "call" && step.node.k === "val" && step.node.v.type === "none") {
            return { kind: "step", list: rest, c: step.c };
          }
          return this.stmtStep(rest, { ...head, e: step.node }, step.c);
        }
        const value = this.valueOf(head.e, frame);
        return this.removed(
          rest,
          "Finishing the expression statement",
          `Finished the expression statement: its value ${this.v(value)} is not used`,
        );
      }
      case "assign": {
        const step = this.reduceExpr(head.e, frame, depth);
        if (step) return this.stmtStep(rest, { ...head, e: step.node }, step.c);
        const value = this.valueOf(head.e, frame);
        const holder = this.store.assign(head.name, value, frame);
        return this.removed(
          rest,
          `Assigning ${head.name} = ${this.v(value)}`,
          `Assigned ${head.name} = ${this.v(value)} in ${this.where(holder)}`,
        );
      }
      case "subassign": {
        // Python evaluates the right-hand side first, then the object, then the index.
        const r = this.reduceChildren([head.e, head.obj, head.index], frame, depth);
        if (r) {
          const node =
            r.index === 0
              ? { ...head, e: r.step.node }
              : r.index === 1
                ? { ...head, obj: r.step.node }
                : { ...head, index: r.step.node };
          return this.stmtStep(rest, node, r.step.c);
        }
        setItem(
          this.valueOf(head.obj, frame),
          this.valueOf(head.index, frame),
          this.valueOf(head.e, frame),
        );
        const text = stmtText(head, this.labels);
        return this.removed(rest, `Assigning ${text}`, `Assigned ${text}`);
      }
      case "augassign": {
        const r = this.reduceChildren([head.read, head.e], frame, depth);
        if (r) {
          const node = r.index === 0 ? { ...head, read: r.step.node } : { ...head, e: r.step.node };
          return this.stmtStep(rest, node, r.step.c);
        }
        const result = inplaceOp(
          head.op,
          this.valueOf(head.read, frame),
          this.valueOf(head.e, frame),
        );
        const holder = this.store.assign(head.name, result, frame);
        return this.removed(
          rest,
          `Assigning ${head.name} ${head.op}= ${this.v(this.valueOf(head.e, frame))}`,
          `Assigned ${head.name} = ${this.v(result)} in ${this.where(holder)}`,
        );
      }
      case "augsub": {
        const r = this.reduceChildren([head.obj, head.index], frame, depth);
        if (r) {
          const node =
            r.index === 0 ? { ...head, obj: r.step.node } : { ...head, index: r.step.node };
          return this.stmtStep(rest, node, r.step.c);
        }
        const obj = this.valueOf(head.obj, frame);
        const index = this.valueOf(head.index, frame);
        // Python reads the element before it evaluates the right-hand side, and combines that
        // old value with the result, even if the right-hand side changed the element.
        const old = head.old ?? getItem(obj, index);
        const r2 = this.reduceChildren([head.e], frame, depth);
        if (r2) return this.stmtStep(rest, { ...head, old, e: r2.step.node }, r2.step.c);
        const result = inplaceOp(head.op, old, this.valueOf(head.e, frame));
        setItem(obj, index, result);
        const text = stmtText(head, this.labels);
        return this.removed(rest, `Assigning ${text}`, `Assigned ${text}`);
      }
      case "def": {
        const src = head.src;
        const fn: FunctionObj = {
          kind: "function",
          name: src.name.lexeme,
          params: src.parameters.map(p => p.lexeme),
          src,
          closure: frame,
          scope: scopeOf(src),
        };
        this.store.assign(src.name.lexeme, { type: "function", obj: fn }, frame);
        return this.removed(
          rest,
          `Defining ${src.name.lexeme}`,
          `Defined ${src.name.lexeme}: function object ${this.labels.object(fn)} in ${this.inEnv(frame)}`,
        );
      }
      case "return": {
        if (head.e === null) {
          const label = this.labels.frame(frame);
          return {
            kind: "return",
            value: NONE,
            c: { before: `Returning None from ${label}`, after: `Returned None from ${label}` },
          };
        }
        const step = this.reduceExpr(head.e, frame, depth);
        if (step) return this.stmtStep(rest, { ...head, e: step.node }, step.c);
        const value = this.valueOf(head.e, frame);
        const label = this.labels.frame(frame);
        return {
          kind: "return",
          value,
          c: {
            before: `Returning ${this.v(value)} from ${label}`,
            after: `Returned ${this.v(value)} from ${label}`,
          },
        };
      }
      case "if": {
        const step = this.reduceExpr(head.test, frame, depth);
        if (step) return this.stmtStep(rest, { ...head, test: step.node }, step.c);
        const test = this.valueOf(head.test, frame);
        const branch = truthy(test) ? head.cons : (head.alt ?? []);
        const condition = `condition is ${this.truth(test)}`;
        return {
          kind: "step",
          list: [...branch, ...rest],
          c: {
            before: "Evaluating if statement",
            after: head.loop
              ? `Evaluated if statement: ${condition}, ${truthy(test) ? "run the loop body" : "the loop ends"}`
              : `Evaluated if statement: ${condition}`,
          },
        };
      }
      case "while": {
        // The textbook rule: `while test: body` is `if test: (body; while test: body)`. The loop
        // stays in the program, in full, while its test is evaluated.
        const loop: Stmt = { k: "loop", body: translateStmts(head.src.body), next: head };
        const unfolded: Stmt = {
          k: "if",
          test: translateExpr(head.src.condition),
          cons: [loop],
          alt: null,
          loop: true,
        };
        return this.stmtStep(rest, unfolded, {
          before: "Unfolding the while loop",
          after: "Unfolded the while loop into an if statement whose body ends with the loop",
        });
      }
      case "forinit": {
        const step = this.reduceExpr(head.iter, frame, depth);
        if (step) return this.stmtStep(rest, { ...head, iter: step.node }, step.c);
        const source = this.valueOf(head.iter, frame);
        if (source.type !== "list" && source.type !== "str" && source.type !== "range") {
          throw new PyError("TypeError", `'${typeName(source)}' object is not iterable`);
        }
        const loop: Stmt = { k: "for", target: head.target, source, pos: 0, src: head.src };
        return this.stmtStep(rest, loop, {
          before: "Evaluating the iterable of the for statement",
          after: `Evaluated the iterable of the for statement: ${this.v(source)}`,
        });
      }
      case "for": {
        const element = iterAt(head.source, head.pos);
        if (element === undefined) {
          return this.removed(
            rest,
            "Evaluating for statement",
            `Evaluated for statement: ${this.v(head.source)} has no more elements, the loop ends`,
          );
        }
        const loop: Stmt = {
          k: "loop",
          body: [
            { k: "assign", name: head.target, e: val(element) },
            ...translateStmts(head.src.body),
          ],
          next: { ...head, pos: head.pos + 1 },
        };
        return this.stmtStep(rest, loop, {
          before: "Evaluating for statement",
          after: `Evaluated for statement: run the body with ${head.target} = ${this.v(element)}`,
        });
      }
      case "loop": {
        const inner = this.stepList(head.body, frame, depth);
        switch (inner.kind) {
          case "step":
            return { kind: "step", list: [{ ...head, body: inner.list }, ...rest], c: inner.c };
          case "return":
            return inner;
          case "break":
            return { kind: "step", list: rest, c: inner.c };
          case "continue":
            return { kind: "step", list: [head.next, ...rest], c: inner.c };
          case "end":
            return {
              kind: "step",
              list: [head.next, ...rest],
              c: {
                before: "Finishing the loop body",
                after: "Finished the loop body, back to the loop",
              },
            };
        }
        break;
      }
      case "pass":
        return this.removed(rest, "Evaluating pass", "Evaluated pass");
      case "break":
        return {
          kind: "break",
          c: { before: "Evaluating break", after: "Evaluated break: the loop ends" },
        };
      case "continue":
        return {
          kind: "continue",
          c: { before: "Evaluating continue", after: "Evaluated continue: back to the loop" },
        };
      case "unsupported":
        throw new UnsupportedError(head.what);
      default:
        // `global` and `nonlocal` are skipped by stepList.
        throw new Error(`the engine cannot step a ${head.k} statement`);
    }
    throw new Error("unreachable");
  }
}
