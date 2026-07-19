/**
 * py2js experiment — compiler.
 *
 * Compiles the py-slang AST (chapter 1 subset) to a JavaScript source string.
 * User identifiers are mangled with a `$` prefix (Python identifiers cannot
 * contain `$`, so this can never collide with runtime names, which all live on
 * the single `__py` parameter).
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
 * Inside the emitters, `a` says whether the code being emitted right now is
 * the async body (await calls) or the sync one.
 */
import { ExprNS, StmtNS } from "../../src/ast-types";

export class Py2JsCompileError extends Error {
  constructor(feature: string) {
    super(`py2js experiment: ${feature} is not supported (chapter 1 subset)`);
    this.name = "Py2JsCompileError";
  }
}

export type CompileMode = "sync" | "dual";

const mangle = (name: string) => "$" + name;

function emitCall(c: ExprNS.Call, a: boolean, dual: boolean): string {
  const callee = emitExpr(c.callee, a, dual);
  const args = c.args.map(arg => emitExpr(arg, a, dual)).join(", ");
  return a ? `(await __py.acall(${callee}, [${args}]))` : `__py.call(${callee}, [${args}])`;
}

function emitFunctionValue(
  name: string,
  params: string[],
  emitBody: (a: boolean) => string,
  dual: boolean,
): string {
  const plist = params.join(", ");
  if (!dual) return `__py.def(${JSON.stringify(name)}, ${params.length}, (${plist}) => ${emitBody(false)})`;
  return (
    `__py.def2(${JSON.stringify(name)}, ${params.length}, ` +
    `(${plist}) => ${emitBody(false)}, ` +
    `async (${plist}) => ${emitBody(true)})`
  );
}

function emitExpr(e: ExprNS.Expr, a: boolean, dual: boolean): string {
  switch (e.kind) {
    case "BigIntLiteral":
      return `${(e as ExprNS.BigIntLiteral).value}n`;
    case "Literal": {
      const v = (e as ExprNS.Literal).value;
      // number literals here are always Python floats (ints arrive as BigIntLiteral)
      return typeof v === "string" ? JSON.stringify(v) : String(v);
    }
    case "None":
      return "null";
    case "Variable":
      return mangle((e as ExprNS.Variable).name.lexeme);
    case "Grouping":
      return `(${emitExpr((e as ExprNS.Grouping).expression, a, dual)})`;
    case "Unary": {
      const u = e as ExprNS.Unary;
      return `__py.unop(${JSON.stringify(u.operator.lexeme)}, ${emitExpr(u.right, a, dual)})`;
    }
    case "Binary": {
      const b = e as ExprNS.Binary;
      return `__py.binop(${JSON.stringify(b.operator.lexeme)}, ${emitExpr(b.left, a, dual)}, ${emitExpr(b.right, a, dual)})`;
    }
    case "Compare": {
      const c = e as ExprNS.Compare;
      return `__py.binop(${JSON.stringify(c.operator.lexeme)}, ${emitExpr(c.left, a, dual)}, ${emitExpr(c.right, a, dual)})`;
    }
    case "BoolOp": {
      const b = e as ExprNS.BoolOp;
      const l = emitExpr(b.left, a, dual);
      const r = emitExpr(b.right, a, dual);
      // Left operand must be bool; result is the left bool when it decides,
      // otherwise the right operand's value (see the CSE BOOL_OP instruction).
      return b.operator.lexeme === "and"
        ? `(__py.boolLeft(${l}, "and") ? ${r} : false)`
        : `(__py.boolLeft(${l}, "or") ? true : ${r})`;
    }
    case "Ternary": {
      const t = e as ExprNS.Ternary;
      return `(__py.truth(${emitExpr(t.predicate, a, dual)}) ? ${emitExpr(t.consequent, a, dual)} : ${emitExpr(t.alternative, a, dual)})`;
    }
    case "Call":
      return emitCall(e as ExprNS.Call, a, dual);
    case "Lambda": {
      const l = e as ExprNS.Lambda;
      // A lambda body is in tail position: evaluating it *is* the return.
      return emitFunctionValue(
        "<lambda>",
        l.parameters.map(p => mangle(p.lexeme)),
        bodyAsync => emitTailPosition(l.body, bodyAsync, dual),
        dual,
      );
    }
    default:
      throw new Py2JsCompileError(`expression kind '${e.kind}'`);
  }
}

/** Compile an expression that sits in return position of a function body. */
function emitTailPosition(e: ExprNS.Expr, a: boolean, dual: boolean): string {
  switch (e.kind) {
    case "Call": {
      // Tail markers work identically in both modes: the marker is returned
      // synchronously (no stack growth, no await) and the caller's
      // trampoline — sync or async — bounces it.
      const c = e as ExprNS.Call;
      return `__py.tail(${emitExpr(c.callee, a, dual)}, [${c.args.map(arg => emitExpr(arg, a, dual)).join(", ")}])`;
    }
    case "Grouping":
      return `(${emitTailPosition((e as ExprNS.Grouping).expression, a, dual)})`;
    case "Ternary": {
      const t = e as ExprNS.Ternary;
      return `(__py.truth(${emitExpr(t.predicate, a, dual)}) ? ${emitTailPosition(t.consequent, a, dual)} : ${emitTailPosition(t.alternative, a, dual)})`;
    }
    case "BoolOp": {
      const b = e as ExprNS.BoolOp;
      const l = emitExpr(b.left, a, dual);
      return b.operator.lexeme === "and"
        ? `(__py.boolLeft(${l}, "and") ? ${emitTailPosition(b.right, a, dual)} : false)`
        : `(__py.boolLeft(${l}, "or") ? true : ${emitTailPosition(b.right, a, dual)})`;
    }
    default:
      return emitExpr(e, a, dual);
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

function emitStmts(stmts: StmtNS.Stmt[], indent: string, a: boolean, dual: boolean): string {
  return stmts.map(s => emitStmt(s, indent, a, dual)).join("");
}

function emitStmt(s: StmtNS.Stmt, indent: string, a: boolean, dual: boolean): string {
  switch (s.kind) {
    case "Pass":
      return `${indent};\n`;
    case "SimpleExpr":
      return `${indent}${emitExpr((s as StmtNS.SimpleExpr).expression, a, dual)};\n`;
    case "Assign": {
      const asg = s as StmtNS.Assign;
      if (asg.target.kind !== "Variable") throw new Py2JsCompileError("subscript assignment");
      return `${indent}${mangle(asg.target.name.lexeme)} = ${emitExpr(asg.value, a, dual)};\n`;
    }
    case "FunctionDef": {
      const f = s as StmtNS.FunctionDef;
      if (f.parameters.some(p => p.isStarred)) throw new Py2JsCompileError("rest parameters");
      const inner = indent + "  ";
      const emitBody = (bodyAsync: boolean) =>
        `{\n` +
        emitDecls(boundNames(f.body), new Set(f.parameters.map(p => p.lexeme)), inner) +
        emitStmts(f.body, inner, bodyAsync, dual) +
        `${inner}return null;\n${indent}}`;
      const fnValue = emitFunctionValue(
        f.name.lexeme,
        f.parameters.map(p => mangle(p.lexeme)),
        emitBody,
        dual,
      );
      return `${indent}${mangle(f.name.lexeme)} = ${fnValue};\n`;
    }
    case "Return": {
      const r = s as StmtNS.Return;
      return r.value === null
        ? `${indent}return null;\n`
        : `${indent}return ${emitTailPosition(r.value, a, dual)};\n`;
    }
    case "If": {
      const i = s as StmtNS.If;
      const head = `${indent}if (__py.truth(${emitExpr(i.condition, a, dual)})) {\n${emitStmts(i.body, indent + "  ", a, dual)}${indent}}`;
      if (i.elseBlock === null) return head + "\n";
      return `${head} else {\n${emitStmts(i.elseBlock, indent + "  ", a, dual)}${indent}}\n`;
    }
    case "Assert":
      return `${indent}__py.assertCheck(${emitExpr((s as StmtNS.Assert).value, a, dual)});\n`;
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
  mode: CompileMode = "sync",
): string {
  if (ast.kind !== "FileInput") throw new Py2JsCompileError(`root node '${ast.kind}'`);
  const file = ast as StmtNS.FileInput;
  const dual = mode === "dual";

  const topLevelNames = boundNames(file.statements);
  const preamble = builtinNames
    .filter(n => !topLevelNames.has(n))
    .map(n => `const ${mangle(n)} = __py.builtins[${JSON.stringify(n)}];\n`)
    .join("");

  return (
    `"use strict";\n` +
    preamble +
    emitDecls(topLevelNames, new Set(), "") +
    emitStmts(file.statements, "", dual, dual)
  );
}
