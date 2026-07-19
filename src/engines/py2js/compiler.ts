/**
 * py2js engine — compiler.
 *
 * Compiles the py-slang AST (chapter 1 subset) to a JavaScript source string,
 * to be instantiated as `new Function("__py", body)` (sync mode) or as an
 * AsyncFunction (dual mode) with a Py2JsRuntime as the `__py` argument.
 *
 * User identifiers are mangled with a `$` prefix (Python identifiers cannot
 * contain `$`, so this can never collide with runtime names, which all live
 * on the single `__py` parameter).
 *
 * Tail calls: `emitTailPosition` compiles an expression in return position so
 * that calls become `__py.tail(f, args)` markers instead of real calls —
 * bounced on the trampoline in runtime.ts. The transform recurses through
 * ternaries, groupings and and/or right operands, mirroring
 * transformReturnStatementsToAllowProperTailCalls in js-slang's transpiler.
 *
 * Modes:
 *  - sync (default): every user function gets one sync body; the whole
 *    program is synchronous. Fastest, but a module call that needs an async
 *    frontend round-trip has nowhere to await.
 *  - dual: every user function gets TWO bodies over one closure environment
 *    (__py.def2) — a sync body, used by `__py.call` and by TS modules
 *    calling back into Python (e.g. sampling a sound wave), and an async
 *    body in which every call is `await __py.acall(...)`, used on the
 *    program's async spine so module round-trips can suspend. The top level
 *    is compiled async in this mode.
 *
 * REPL mode (options.repl, used by Py2JsSession / the conductor evaluator):
 * the program is one *chunk* of a persistent session. Top-level bindings —
 * this chunk's and all earlier chunks' — live in the runtime's `globals`
 * table instead of `let` declarations: writes are direct stores, reads go
 * through `__py.gref`, which raises Python's NameError for a name whose
 * binding statement never actually executed. Routing every module-level
 * reference through the table (rather than freezing values into per-chunk
 * `const`s, as js-slang's transpiler does) gives CSE-machine parity for late
 * binding: a function defined in chunk 1 that calls helper g sees chunk 3's
 * *redefinition* of g, exactly like the CSE machine's global environment
 * frame. Function-local scopes are unaffected — locals stay `let`-compiled.
 * Chapter 1 has no `global` keyword, so a name is module-level iff it is
 * bound at the top level of some chunk; no other scope analysis is needed.
 *
 * Inside the emitters, `a` says whether the code being emitted right now is
 * the async body (await calls) or the sync one; `ctx` carries the fixed
 * compilation config plus the stack of enclosing function scopes.
 *
 * The compiler assumes the program has already passed the resolver with the
 * chapter's validators (see index.ts); the Py2JsCompileError throws below are
 * a backstop for constructs the validators admit but this engine does not
 * support yet, not the primary user-facing diagnostics.
 */
import { ExprNS, StmtNS } from "../../ast-types";

export class Py2JsCompileError extends Error {
  constructor(feature: string) {
    super(`py2js: ${feature} is not supported (chapter 1 subset)`);
    this.name = "Py2JsCompileError";
  }
}

export type CompileMode = "sync" | "dual";

export interface CompileOptions {
  mode?: CompileMode;
  /**
   * REPL mode (see file header): compile as one chunk of a persistent
   * session. `priorGlobals` are the names earlier chunks (or the prelude)
   * have already bound in the runtime's globals table.
   */
  repl?: { priorGlobals: string[] };
}

interface Scope {
  /** Parameters: always bound at function entry — reads need no guard. */
  params: Set<string>;
  /** Non-parameter locals (`let`-declared at body top, assigned where the
   * Python assignment executes): a read may precede the assignment. */
  locals: Set<string>;
}

interface EmitCtx {
  dual: boolean;
  /**
   * REPL mode only: every module-level name — this chunk's top-level
   * bindings plus priorGlobals. References resolve through the runtime's
   * globals table unless shadowed by an enclosing function scope. undefined
   * in program mode.
   */
  globals?: Set<string>;
  /** Program mode only: the program's top-level names — `let`-compiled, with
   * reads guarded like locals but raising NameError (module level). */
  programGlobals?: Set<string>;
  /** Enclosing function scopes, outermost first. */
  scopes: Scope[];
}

const mangle = (name: string) => "$" + name;

/**
 * A name reference or assignment target, resolved against the scope stack.
 *
 * Unbound-read guards: Python has no TDZ — its environments grow
 * dynamically — but reading a binding whose assignment never executed is
 * still an error (UnboundLocalError for function locals, NameError at module
 * level), which the CSE machine mirrors. JS `let` initializes to undefined
 * instead, so every read of a guardable binding compiles to an inline
 * `=== undefined` check; undefined is not a PyValue (None is null), so the
 * check is exact, and it costs one perfectly-predicted comparison. Parameters
 * are always bound and skip the guard; REPL-mode module names go through
 * gref, which performs the same check inside the runtime.
 */
function emitName(name: string, ctx: EmitCtx, write: boolean): string {
  const j = JSON.stringify(name);
  for (let i = ctx.scopes.length - 1; i >= 0; i--) {
    if (ctx.scopes[i].params.has(name)) return mangle(name);
    if (ctx.scopes[i].locals.has(name)) {
      const m = mangle(name);
      return write ? m : `(${m} === undefined ? __py.unboundErr(${j}) : ${m})`;
    }
  }
  if (ctx.globals?.has(name)) {
    return write ? `__py.globals[${j}]` : `__py.gref(${j})`;
  }
  if (ctx.programGlobals?.has(name)) {
    const m = mangle(name);
    return write ? m : `(${m} === undefined ? __py.nameErr(${j}) : ${m})`;
  }
  return mangle(name);
}

/** Serialize a float component of a complex literal (finite, or inf/nan from
 * PyComplexNumber.fromString) into a JS number expression. */
const emitFloat = (n: number): string =>
  Number.isFinite(n) ? String(n) : Number.isNaN(n) ? "NaN" : n > 0 ? "Infinity" : "-Infinity";

function emitCall(c: ExprNS.Call, a: boolean, ctx: EmitCtx): string {
  const callee = emitExpr(c.callee, a, ctx);
  const args = c.args.map(arg => emitExpr(arg, a, ctx)).join(", ");
  return a ? `(await __py.acall(${callee}, [${args}]))` : `__py.call(${callee}, [${args}])`;
}

/**
 * Emit a function value (def or lambda). `scope` is the new function scope
 * (params + locals); it is pushed around each body emission — twice in dual
 * mode, once per body, both over the same closure environment.
 */
function emitFunctionValue(
  name: string,
  params: string[],
  scope: Scope,
  emitBody: (a: boolean) => string,
  ctx: EmitCtx,
): string {
  const emitOnce = (a: boolean): string => {
    ctx.scopes.push(scope);
    try {
      return emitBody(a);
    } finally {
      ctx.scopes.pop();
    }
  };
  const plist = params.map(mangle).join(", ");
  if (!ctx.dual) {
    return `__py.def(${JSON.stringify(name)}, ${params.length}, (${plist}) => ${emitOnce(false)})`;
  }
  return (
    `__py.def2(${JSON.stringify(name)}, ${params.length}, ` +
    `(${plist}) => ${emitOnce(false)}, ` +
    `async (${plist}) => ${emitOnce(true)})`
  );
}

function emitExpr(e: ExprNS.Expr, a: boolean, ctx: EmitCtx): string {
  switch (e.kind) {
    case "BigIntLiteral":
      return `${(e as ExprNS.BigIntLiteral).value}n`;
    case "Literal": {
      const v = (e as ExprNS.Literal).value;
      // number literals here are always Python floats (ints arrive as BigIntLiteral)
      return typeof v === "string" ? JSON.stringify(v) : String(v);
    }
    case "Complex": {
      const c = (e as ExprNS.Complex).value;
      return `__py.complex(${emitFloat(c.real)}, ${emitFloat(c.imag)})`;
    }
    case "None":
      return "null";
    case "Variable":
      return emitName((e as ExprNS.Variable).name.lexeme, ctx, false);
    case "Grouping":
      return `(${emitExpr((e as ExprNS.Grouping).expression, a, ctx)})`;
    case "Unary": {
      const u = e as ExprNS.Unary;
      return `__py.unop(${JSON.stringify(u.operator.lexeme)}, ${emitExpr(u.right, a, ctx)})`;
    }
    case "Binary": {
      const b = e as ExprNS.Binary;
      return `__py.binop(${JSON.stringify(b.operator.lexeme)}, ${emitExpr(b.left, a, ctx)}, ${emitExpr(b.right, a, ctx)})`;
    }
    case "Compare": {
      const c = e as ExprNS.Compare;
      return `__py.binop(${JSON.stringify(c.operator.lexeme)}, ${emitExpr(c.left, a, ctx)}, ${emitExpr(c.right, a, ctx)})`;
    }
    case "BoolOp": {
      const b = e as ExprNS.BoolOp;
      const l = emitExpr(b.left, a, ctx);
      const r = emitExpr(b.right, a, ctx);
      // Left operand must be bool; result is the left bool when it decides,
      // otherwise the right operand's value (see the CSE BOOL_OP instruction).
      return b.operator.lexeme === "and"
        ? `(__py.boolLeft(${l}, "and") ? ${r} : false)`
        : `(__py.boolLeft(${l}, "or") ? true : ${r})`;
    }
    case "Ternary": {
      const t = e as ExprNS.Ternary;
      return `(__py.truth(${emitExpr(t.predicate, a, ctx)}) ? ${emitExpr(t.consequent, a, ctx)} : ${emitExpr(t.alternative, a, ctx)})`;
    }
    case "Call":
      return emitCall(e as ExprNS.Call, a, ctx);
    case "Lambda": {
      const l = e as ExprNS.Lambda;
      const params = l.parameters.map(p => p.lexeme);
      // A lambda body is in tail position: evaluating it *is* the return.
      // "(anonymous)" matches the CSE machine's rendering of lambda values
      // (toPythonString on a nameless closure), pinned by the stdlib sweep.
      return emitFunctionValue(
        "(anonymous)",
        params,
        { params: new Set(params), locals: new Set() },
        bodyAsync => emitTailPosition(l.body, bodyAsync, ctx),
        ctx,
      );
    }
    default:
      throw new Py2JsCompileError(`expression kind '${e.kind}'`);
  }
}

/** Compile an expression that sits in return position of a function body. */
function emitTailPosition(e: ExprNS.Expr, a: boolean, ctx: EmitCtx): string {
  switch (e.kind) {
    case "Call": {
      // Tail markers work identically in both modes: the marker is returned
      // synchronously (no stack growth, no await) and the caller's
      // trampoline — sync or async — bounces it.
      const c = e as ExprNS.Call;
      return `__py.tail(${emitExpr(c.callee, a, ctx)}, [${c.args.map(arg => emitExpr(arg, a, ctx)).join(", ")}])`;
    }
    case "Grouping":
      return `(${emitTailPosition((e as ExprNS.Grouping).expression, a, ctx)})`;
    case "Ternary": {
      const t = e as ExprNS.Ternary;
      return `(__py.truth(${emitExpr(t.predicate, a, ctx)}) ? ${emitTailPosition(t.consequent, a, ctx)} : ${emitTailPosition(t.alternative, a, ctx)})`;
    }
    case "BoolOp": {
      const b = e as ExprNS.BoolOp;
      const l = emitExpr(b.left, a, ctx);
      return b.operator.lexeme === "and"
        ? `(__py.boolLeft(${l}, "and") ? ${emitTailPosition(b.right, a, ctx)} : false)`
        : `(__py.boolLeft(${l}, "or") ? true : ${emitTailPosition(b.right, a, ctx)})`;
    }
    default:
      return emitExpr(e, a, ctx);
  }
}

/**
 * Names bound in a scope: assignment targets and def names, including inside
 * if/else arms, but NOT inside nested function bodies (those are their own
 * scopes). The resolver leaves FunctionDef/FileInput varDecls unpopulated, so
 * the compiler scans for itself. Chapter 1 has no loops or global/nonlocal,
 * which keeps this exact.
 */
function boundNames(stmts: StmtNS.Stmt[], into: Set<string> = new Set()): Set<string> {
  for (const s of stmts) {
    if (s.kind === "Assign") {
      const target = (s as StmtNS.Assign).target;
      if (target.kind === "Variable") into.add(target.name.lexeme);
    } else if (s.kind === "FunctionDef") {
      into.add((s as StmtNS.FunctionDef).name.lexeme);
    } else if (s.kind === "If") {
      const i = s as StmtNS.If;
      boundNames(i.body, into);
      if (i.elseBlock !== null) boundNames(i.elseBlock, into);
    }
  }
  return into;
}

function emitDecls(names: Set<string>, exclude: Set<string>, indent: string): string {
  const filtered = [...names].filter(n => !exclude.has(n));
  return filtered.length === 0 ? "" : `${indent}let ${filtered.map(mangle).join(", ")};\n`;
}

function emitStmts(stmts: StmtNS.Stmt[], indent: string, a: boolean, ctx: EmitCtx): string {
  return stmts.map(s => emitStmt(s, indent, a, ctx)).join("");
}

function emitStmt(s: StmtNS.Stmt, indent: string, a: boolean, ctx: EmitCtx): string {
  switch (s.kind) {
    case "Pass":
      return `${indent};\n`;
    case "SimpleExpr":
      return `${indent}${emitExpr((s as StmtNS.SimpleExpr).expression, a, ctx)};\n`;
    case "Assign": {
      const asg = s as StmtNS.Assign;
      if (asg.target.kind !== "Variable") throw new Py2JsCompileError("subscript assignment");
      return `${indent}${emitName(asg.target.name.lexeme, ctx, true)} = ${emitExpr(asg.value, a, ctx)};\n`;
    }
    case "FunctionDef": {
      const f = s as StmtNS.FunctionDef;
      if (f.parameters.some(p => p.isStarred)) throw new Py2JsCompileError("rest parameters");
      const params = f.parameters.map(p => p.lexeme);
      const locals = boundNames(f.body);
      const paramSet = new Set(params);
      const scope: Scope = {
        params: paramSet,
        locals: new Set([...locals].filter(n => !paramSet.has(n))),
      };
      const inner = indent + "  ";
      const emitBody = (bodyAsync: boolean) =>
        `{\n` +
        emitDecls(locals, new Set(params), inner) +
        emitStmts(f.body, inner, bodyAsync, ctx) +
        `${inner}return null;\n${indent}}`;
      const fnValue = emitFunctionValue(f.name.lexeme, params, scope, emitBody, ctx);
      return `${indent}${emitName(f.name.lexeme, ctx, true)} = ${fnValue};\n`;
    }
    case "Return": {
      const r = s as StmtNS.Return;
      return r.value === null
        ? `${indent}return null;\n`
        : `${indent}return ${emitTailPosition(r.value, a, ctx)};\n`;
    }
    case "If": {
      const i = s as StmtNS.If;
      const head = `${indent}if (__py.truth(${emitExpr(i.condition, a, ctx)})) {\n${emitStmts(i.body, indent + "  ", a, ctx)}${indent}}`;
      if (i.elseBlock === null) return head + "\n";
      return `${head} else {\n${emitStmts(i.elseBlock, indent + "  ", a, ctx)}${indent}}\n`;
    }
    case "Assert":
      return `${indent}__py.assertCheck(${emitExpr((s as StmtNS.Assert).value, a, ctx)});\n`;
    default:
      throw new Py2JsCompileError(`statement kind '${s.kind}'`);
  }
}

/**
 * Compile a parsed program (FileInput) into the body of a
 * `new Function("__py", body)` (sync mode) or an AsyncFunction (dual mode) —
 * the runtime is the single free variable.
 */
export function compileProgram(
  ast: StmtNS.Stmt,
  builtinNames: string[],
  options: CompileOptions = {},
): string {
  if (ast.kind !== "FileInput") throw new Py2JsCompileError(`root node '${ast.kind}'`);
  const file = ast as StmtNS.FileInput;
  const dual = options.mode === "dual";

  const topLevelNames = boundNames(file.statements);
  const ctx: EmitCtx = {
    dual,
    scopes: [],
    globals: options.repl ? new Set([...options.repl.priorGlobals, ...topLevelNames]) : undefined,
    programGlobals: options.repl ? undefined : topLevelNames,
  };

  // A builtin resolves as a preamble const unless some chunk-level binding
  // (this chunk's, or in REPL mode any earlier chunk's) takes the name over.
  const preamble = builtinNames
    .filter(n => !topLevelNames.has(n) && !ctx.globals?.has(n))
    .map(n => `const ${mangle(n)} = __py.builtins[${JSON.stringify(n)}];\n`)
    .join("");

  return (
    `"use strict";\n` +
    preamble +
    (ctx.globals ? "" : emitDecls(topLevelNames, new Set(), "")) +
    emitStmts(file.statements, "", dual, ctx)
  );
}
