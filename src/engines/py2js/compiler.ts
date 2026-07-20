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
 *
 * Chapter 3+ adds `global`/`nonlocal`, which is where JS's TDZ would
 * otherwise clash with Python's dynamically-growing environments: a function
 * can do `global x; x = 5` for an `x` no top-level statement ever assigns
 * directly (module.globalPreScan below folds every such function-introduced
 * global into the module's name set, mirroring the Resolver's
 * visitFunctionDefStmt pre-registration), and a name declared `global`/
 * `nonlocal` inside a function must be *excluded* from that function's own
 * hoisted locals (functionScopeNames below) so emitName's scope-chain walk
 * falls through to the outer binding — module globals table or an enclosing
 * function's own hoisted `let` — instead of shadowing it. Every other
 * mechanism (hoist-all-locals-as-`let`-up-front, guarded `=== undefined`
 * reads) is unchanged from chapter 1/2 and needs no special-casing for loops
 * or global/nonlocal beyond boundNames recursing into their bodies.
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
    super(`py2js: ${feature} is not supported`);
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
  /** Mutable counter for unique hidden for-loop temp names (nested for-loops
   * each need their own `_loop_i`/`_end`/`_step`, never user-visible so they
   * need no emitName/boundNames treatment at all). */
  forId: { next: number };
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
    case "List": {
      const l = e as ExprNS.List;
      return `[${l.elements.map(el => emitExpr(el, a, ctx)).join(", ")}]`;
    }
    case "Subscript": {
      const s = e as ExprNS.Subscript;
      return `__py.listAccess(${emitExpr(s.value, a, ctx)}, ${emitExpr(s.index, a, ctx)})`;
    }
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
 * Names bound in a scope: assignment targets, def names, and for-loop
 * targets, including inside if/else arms and while/for bodies, but NOT
 * inside nested function bodies (those are their own scopes). The resolver
 * leaves FunctionDef/FileInput varDecls unpopulated, so the compiler scans
 * for itself.
 */
function boundNames(stmts: StmtNS.Stmt[], into: Set<string> = new Set()): Set<string> {
  for (const s of stmts) {
    if (s.kind === "Assign") {
      const target = (s as StmtNS.Assign).target;
      if (target.kind === "Variable") into.add(target.name.lexeme);
    } else if (s.kind === "FunctionDef") {
      into.add((s as StmtNS.FunctionDef).name.lexeme);
    } else if (s.kind === "FromImport") {
      for (const spec of (s as StmtNS.FromImport).names) {
        into.add((spec.alias ?? spec.name).lexeme);
      }
    } else if (s.kind === "If") {
      const i = s as StmtNS.If;
      boundNames(i.body, into);
      if (i.elseBlock !== null) boundNames(i.elseBlock, into);
    } else if (s.kind === "While") {
      boundNames((s as StmtNS.While).body, into);
    } else if (s.kind === "For") {
      const f = s as StmtNS.For;
      into.add(f.target.lexeme);
      boundNames(f.body, into);
    }
  }
  return into;
}

/**
 * Names declared `global` or `nonlocal` directly in this function's own
 * body — recurses into if/while/for but stops at nested FunctionDefs (a
 * nested function's own global/nonlocal declarations are its own scope's
 * concern, resolved when *that* function is compiled). Mirrors
 * scanGlobalDeclarations/scanNonlocalDeclarations in resolver.ts, which
 * already do this same scan for the Resolver's own scope analysis.
 */
function scanScopeDeclarations(stmts: StmtNS.Stmt[], kind: "Global" | "NonLocal"): Set<string> {
  const names = new Set<string>();
  const visit = (body: StmtNS.Stmt[]): void => {
    for (const s of body) {
      if (s.kind === kind) {
        names.add((s as StmtNS.Global | StmtNS.NonLocal).name.lexeme);
      } else if (s.kind === "If") {
        visit((s as StmtNS.If).body);
        const elseBlock = (s as StmtNS.If).elseBlock;
        if (elseBlock !== null) visit(elseBlock);
      } else if (s.kind === "While") {
        visit((s as StmtNS.While).body);
      } else if (s.kind === "For") {
        visit((s as StmtNS.For).body);
      }
    }
  };
  visit(stmts);
  return names;
}

/**
 * Every name declared `global` anywhere in the program, at any nesting depth
 * (unlike scanScopeDeclarations, this *does* descend into nested
 * FunctionDefs — a `global x` ten functions deep still refers to the one
 * module scope). Folded into the module's name set so a function that
 * introduces a global with no top-level assignment anywhere (`def f():
 * global x; x = 5`, no `x = ...` at module level) still resolves through the
 * globals table/hoisted module `let` instead of falling through to an
 * undeclared bare identifier — Python's environments grow dynamically;
 * nothing here needs the whole name to be visible textually at module level
 * first. Mirrors visitFunctionDefStmt's pre-registration of such names into
 * the module environment in resolver.ts.
 */
function collectAllGlobalDecls(stmts: StmtNS.Stmt[], into: Set<string> = new Set()): Set<string> {
  for (const s of stmts) {
    if (s.kind === "Global") {
      into.add((s as StmtNS.Global).name.lexeme);
    } else if (s.kind === "If") {
      collectAllGlobalDecls((s as StmtNS.If).body, into);
      const elseBlock = (s as StmtNS.If).elseBlock;
      if (elseBlock !== null) collectAllGlobalDecls(elseBlock, into);
    } else if (s.kind === "While") {
      collectAllGlobalDecls((s as StmtNS.While).body, into);
    } else if (s.kind === "For") {
      collectAllGlobalDecls((s as StmtNS.For).body, into);
    } else if (s.kind === "FunctionDef") {
      collectAllGlobalDecls((s as StmtNS.FunctionDef).body, into);
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
      if (asg.target.kind === "Subscript") {
        const t = asg.target;
        // Evaluation order (list, index, value) matches CSE's LIST_ASSIGNMENT
        // instruction (evaluateListAssignment in cse/utils.ts) — JS argument
        // evaluation order reproduces it directly.
        return `${indent}__py.listAssign(${emitExpr(t.value, a, ctx)}, ${emitExpr(t.index, a, ctx)}, ${emitExpr(asg.value, a, ctx)});\n`;
      }
      return `${indent}${emitName(asg.target.name.lexeme, ctx, true)} = ${emitExpr(asg.value, a, ctx)};\n`;
    }
    case "FunctionDef": {
      const f = s as StmtNS.FunctionDef;
      if (f.parameters.some(p => p.isStarred)) throw new Py2JsCompileError("rest parameters");
      const params = f.parameters.map(p => p.lexeme);
      const paramSet = new Set(params);
      // Names this function declares `global`/`nonlocal` are excluded from its
      // own hoisted locals — see the file header and scanScopeDeclarations —
      // so emitName's scope-chain walk falls through to the outer binding
      // instead of shadowing it with a fresh local `let`.
      const globalDecls = scanScopeDeclarations(f.body, "Global");
      const nonlocalDecls = scanScopeDeclarations(f.body, "NonLocal");
      const locals = new Set(
        [...boundNames(f.body)].filter(
          n => !paramSet.has(n) && !globalDecls.has(n) && !nonlocalDecls.has(n),
        ),
      );
      const scope: Scope = { params: paramSet, locals };
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
    case "While": {
      const w = s as StmtNS.While;
      // whileCond, unlike the truth() used by if/ternary, demands a literal
      // bool — mirrors the CSE machine's WHILE instruction, which is
      // deliberately stricter than Python's usual any-type truthiness here
      // (see src/tests/loops.test.ts's "while 1:"/"while y + 1:" TypeError
      // cases; truth()'s own doc comment already flags this asymmetry).
      return `${indent}while (__py.whileCond(${emitExpr(w.condition, a, ctx)})) {\n${emitStmts(w.body, indent + "  ", a, ctx)}${indent}}\n`;
    }
    case "For": {
      const f = s as StmtNS.For;
      // ForRangeOnlyValidator (the resolver) already guarantees this shape —
      // for x in range(<=3 args) — before the compiler ever sees it; the
      // instanceof/arity check below is just a backstop.
      if (
        f.iter.kind !== "Call" ||
        (f.iter as ExprNS.Call).callee.kind !== "Variable" ||
        ((f.iter as ExprNS.Call).callee as ExprNS.Variable).name.lexeme !== "range" ||
        (f.iter as ExprNS.Call).args.length < 1 ||
        (f.iter as ExprNS.Call).args.length > 3
      ) {
        throw new Py2JsCompileError("for-loops other than 'for x in range(...)'");
      }
      const iter = f.iter as ExprNS.Call;
      const rangeArgs = iter.args;
      const zero = "0n";
      const one = "1n";
      let startSrc: string;
      let endSrc: string;
      let stepSrc: string;
      if (rangeArgs.length === 1) {
        startSrc = zero;
        endSrc = emitExpr(rangeArgs[0], a, ctx);
        stepSrc = one;
      } else if (rangeArgs.length === 2) {
        startSrc = emitExpr(rangeArgs[0], a, ctx);
        endSrc = emitExpr(rangeArgs[1], a, ctx);
        stepSrc = one;
      } else {
        startSrc = emitExpr(rangeArgs[0], a, ctx);
        endSrc = emitExpr(rangeArgs[1], a, ctx);
        stepSrc = emitExpr(rangeArgs[2], a, ctx);
      }
      // Desugars exactly per docs/specs/python_loops.tex: a hidden counter
      // distinct from the user-visible loop target, so the loop body may
      // freely reassign the target without perturbing the iteration (see
      // src/tests/loops.test.ts's "for i in range(5): i = 0" case, whose
      // final `i` is 0, not 4). Range args are evaluated once, up front.
      //
      // The counter's advance is a JS `for(...)` update clause, not a
      // trailing statement in a `while` body: a `continue` in the loop body
      // must still advance the (implicit, user-invisible) counter before
      // re-checking the condition — exactly matching CSE's CONTINUE_MARKER
      // placement, which sits after the body but before the "compute next
      // start" step (see evaluateForIterator/the FOR instruction handler in
      // src/engines/cse/interpreter.ts). A trailing increment after a plain
      // `while` body would be skipped by `continue`, hanging the loop
      // forever the first time the body actually continues.
      const id = ctx.forId.next++;
      const iVar = `$__for${id}_i`;
      const endVar = `$__for${id}_end`;
      const stepVar = `$__for${id}_step`;
      const targetAssign = `${emitName(f.target.lexeme, ctx, true)} = ${iVar};\n`;
      const inner = indent + "    ";
      const body = emitStmts(f.body, inner, a, ctx);
      return (
        `${indent}let ${iVar} = ${startSrc}, ${endVar} = ${endSrc}, ${stepVar} = ${stepSrc};\n` +
        `${indent}__py.forRangeCheck(${iVar}, ${endVar}, ${stepVar});\n` +
        `${indent}if (${stepVar} > 0n) {\n` +
        `${indent}  for (; ${iVar} < ${endVar}; ${iVar} = ${iVar} + ${stepVar}) {\n` +
        `${indent}    ${targetAssign}${body}${indent}  }\n` +
        `${indent}} else {\n` +
        `${indent}  for (; ${iVar} > ${endVar}; ${iVar} = ${iVar} + ${stepVar}) {\n` +
        `${indent}    ${targetAssign}${body}${indent}  }\n` +
        `${indent}}\n`
      );
    }
    case "Break":
      return `${indent}break;\n`;
    case "Continue":
      return `${indent}continue;\n`;
    case "Global":
    case "NonLocal":
      // No codegen: entirely handled by excluding the name from this
      // function's hoisted locals (see the FunctionDef case and the file
      // header) so emitName's scope-chain walk resolves it to the outer
      // binding on its own.
      return "";
    case "Assert":
      return `${indent}__py.assertCheck(${emitExpr((s as StmtNS.Assert).value, a, ctx)});\n`;
    case "FromImport": {
      // The imported values are resolved (module loaded, converted to
      // native PyValues) in an async pre-pass before this chunk compiles —
      // see moduleInterop.ts and Py2JsSession.runChunk in index.ts — and
      // stashed on the runtime keyed by the bound (aliased) name. This
      // statement's only job is the binding itself, through the same
      // emitName(write=true) path an ordinary assignment uses, so it works
      // identically in program mode (`let` local) and REPL mode (globals
      // table) without a separate code path.
      const imp = s as StmtNS.FromImport;
      return imp.names
        .map(spec => {
          const bound = (spec.alias ?? spec.name).lexeme;
          return `${indent}${emitName(bound, ctx, true)} = __py.importedValue(${JSON.stringify(bound)});\n`;
        })
        .join("");
    }
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

  // Module-level names: this chunk's top-level bindings, plus every name any
  // (possibly nested) function in the chunk declares `global` for — even one
  // with no top-level assignment anywhere (see collectAllGlobalDecls's doc
  // comment) — so such a name resolves through the globals table/hoisted
  // module `let` instead of falling through emitName to an undeclared bare
  // identifier.
  const topLevelNames = new Set([
    ...boundNames(file.statements),
    ...collectAllGlobalDecls(file.statements),
  ]);
  const ctx: EmitCtx = {
    dual,
    scopes: [],
    globals: options.repl ? new Set([...options.repl.priorGlobals, ...topLevelNames]) : undefined,
    programGlobals: options.repl ? undefined : topLevelNames,
    forId: { next: 0 },
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
