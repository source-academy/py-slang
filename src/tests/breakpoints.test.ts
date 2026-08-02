/**
 * Unit tests for `markBreakpoints` (../breakpoints), the "closest enclosing statement for a
 * gutter-clicked line" resolution used by issue #383. The stepper/CSE-machine-facing behaviour
 * (the flag actually surfacing as a breakpoint step) is covered separately by
 * `conductor/stepper/__tests__/getSteps.test.ts` and `PyCseMachinePlugin.test.ts`; this file
 * exercises the marking pass itself, in isolation.
 */

import { StmtNS } from "../ast-types";
import { markBreakpoints } from "../breakpoints";
import { parse } from "../parser/parser-adapter";

type Flagged = StmtNS.Stmt & { hasBreakpoint?: boolean };

/** `"<kind>@<line>"` for every flagged statement in `ast`, depth-first. */
function flagged(ast: StmtNS.FileInput): string[] {
  const out: string[] = [];
  function walk(stmt: StmtNS.Stmt): void {
    if ((stmt as Flagged).hasBreakpoint) out.push(`${stmt.kind}@${stmt.startToken.line}`);
    switch (stmt.kind) {
      case "If": {
        const s = stmt as StmtNS.If;
        s.body.forEach(walk);
        s.elseBlock?.forEach(walk);
        break;
      }
      case "While":
        (stmt as StmtNS.While).body.forEach(walk);
        break;
      case "For":
        (stmt as StmtNS.For).body.forEach(walk);
        break;
      case "FunctionDef":
        (stmt as StmtNS.FunctionDef).body.forEach(walk);
        break;
    }
  }
  ast.statements.forEach(walk);
  return out;
}

describe("markBreakpoints", () => {
  it("flags the statement on the clicked line", () => {
    const ast = parse("x = 1\ny = 2\n");
    markBreakpoints(ast, [2]);
    expect(flagged(ast)).toEqual(["Assign@2"]);
  });

  it("flags the innermost statement, not an enclosing block", () => {
    const ast = parse(`if True:
    x = 1
    y = 2
`);
    markBreakpoints(ast, [3]);
    expect(flagged(ast)).toEqual(["Assign@3"]);
  });

  it("flags the if statement itself when the click is on its header line", () => {
    const ast = parse(`if True:
    x = 1
`);
    markBreakpoints(ast, [1]);
    expect(flagged(ast)).toEqual(["If@1"]);
  });

  it("flags a loop body statement inside a for loop", () => {
    const ast = parse(`for i in range(3):
    x = i
`);
    markBreakpoints(ast, [2]);
    expect(flagged(ast)).toEqual(["Assign@2"]);
  });

  it("flags a statement inside a function body", () => {
    const ast = parse(`def f():
    x = 1
    return x
`);
    markBreakpoints(ast, [3]);
    expect(flagged(ast)).toEqual(["Return@3"]);
  });

  it("snaps a blank-line click to the next statement", () => {
    const ast = parse(`x = 1

y = 2
`);
    markBreakpoints(ast, [2]);
    expect(flagged(ast)).toEqual(["Assign@3"]);
  });

  it("ignores a line past the last statement", () => {
    const ast = parse("x = 1\n");
    markBreakpoints(ast, [10]);
    expect(flagged(ast)).toEqual([]);
  });

  it("is a no-op when no lines are requested", () => {
    const ast = parse("x = 1\n");
    markBreakpoints(ast, []);
    expect(flagged(ast)).toEqual([]);
  });

  it("flags multiple requested lines independently", () => {
    const ast = parse("x = 1\ny = 2\nz = 3\n");
    markBreakpoints(ast, [1, 3]);
    expect(flagged(ast).sort()).toEqual(["Assign@1", "Assign@3"]);
  });
});
