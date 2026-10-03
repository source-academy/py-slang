/**
 * Resolves gutter-clicked line numbers to AST nodes, for issue #383: "Proper breakpoints with
 * gutter clicks". A gutter click only carries a line number, not an AST node, so this walks the
 * parsed tree once per run and flags the statement each requested line resolves to. The stepper
 * (`conductor/stepper`) and CSE machine (`engines/cse`) each separately check the resulting flag
 * and treat it exactly like an explicit `breakpoint()` call.
 */

import { StmtNS } from "./ast-types";

/** Bolted onto statement instances, mirroring `engines/cse/types.ts`'s `isEnvDependent` — not
 * part of the generated `ast-types.ts`, since it's per-run state, not part of the grammar. */
type BreakpointFlag = { hasBreakpoint?: boolean };

/** Every statement in `stmt`'s subtree (including `stmt` itself), depth-first. Only the five
 * statement kinds that own a nested statement list (`ast-types.ts`) are recursed into. */
function collectStatements(stmt: StmtNS.Stmt, out: StmtNS.Stmt[]): void {
  out.push(stmt);
  switch (stmt.kind) {
    case "If": {
      const s = stmt as StmtNS.If;
      s.body.forEach(child => collectStatements(child, out));
      s.elseBlock?.forEach(child => collectStatements(child, out));
      break;
    }
    case "While":
      (stmt as StmtNS.While).body.forEach(child => collectStatements(child, out));
      break;
    case "For":
      (stmt as StmtNS.For).body.forEach(child => collectStatements(child, out));
      break;
    case "FunctionDef":
      (stmt as StmtNS.FunctionDef).body.forEach(child => collectStatements(child, out));
      break;
    case "FileInput":
      (stmt as StmtNS.FileInput).statements.forEach(child => collectStatements(child, out));
      break;
  }
}

/** For a single target line, the statement that best represents "the line the student clicked":
 * the smallest statement whose own span covers it, or (for a blank/comment line, or a line
 * between statements) the nearest statement that starts on or after it. `null` if `line` is past
 * every statement in the file. */
function closestStatementForLine(statements: StmtNS.Stmt[], line: number): StmtNS.Stmt | null {
  let bestCovering: StmtNS.Stmt | null = null;
  let bestCoveringSpan = Infinity;
  let bestFollowing: StmtNS.Stmt | null = null;
  let bestFollowingLine = Infinity;

  for (const stmt of statements) {
    const start = stmt.startToken.line;
    const end = stmt.endToken.line;
    if (start <= line && line <= end) {
      const span = end - start;
      if (span < bestCoveringSpan) {
        bestCovering = stmt;
        bestCoveringSpan = span;
      }
    } else if (start > line && start < bestFollowingLine) {
      bestFollowing = stmt;
      bestFollowingLine = start;
    }
  }

  return bestCovering ?? bestFollowing;
}

/**
 * Flags, for each line in `lines`, the closest enclosing statement in `ast` with
 * `hasBreakpoint = true`. The stepper and CSE machine each check this flag where they already
 * check for an explicit `breakpoint()` call, and record the same kind of step for it.
 */
export function markBreakpoints(ast: StmtNS.FileInput, lines: number[]): void {
  if (lines.length === 0) return;

  const statements: StmtNS.Stmt[] = [];
  ast.statements.forEach(stmt => collectStatements(stmt, statements));

  for (const line of lines) {
    const match = closestStatementForLine(statements, line);
    if (match) (match as StmtNS.Stmt & BreakpointFlag).hasBreakpoint = true;
  }
}
