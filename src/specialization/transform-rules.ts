import { ExprNS, StmtNS } from "../ast-types";
import type { HintTable, StmtTransformRule, ExprTransformRule, ConstLattice } from "./analysis-module";

/**
 * Constant folding: replaces a Binary or Compare expression whose result is
 * statically known (constVal.tag === "const") with a Literal node.
 *
 * Reads: hints.get(expr).constVal
 * Fires on: Binary, Compare (after ConstAnalysisModule has converged)
 */
export class ConstantFoldingRule implements ExprTransformRule {
  readonly name = "constant-folding";
  readonly level = "expr" as const;

  matches(expr: ExprNS.Expr, hints: HintTable): boolean {
    if (!(expr instanceof ExprNS.Binary || expr instanceof ExprNS.Compare)) return false;
    return hints.get(expr)?.constVal?.tag === "const";
  }

  apply(expr: ExprNS.Expr, hints: HintTable): ExprNS.Expr {
    const cv = hints.get(expr)!.constVal as ConstLattice & { tag: "const" };
    // Reuse the original expression's token span so source locations remain valid.
    return new ExprNS.Literal(expr.startToken, expr.endToken, cv.value as true | false | number | string);
  }
}

/**
 * Dead branch elimination: replaces an If statement whose condition is a
 * statically known boolean constant with the taken branch body.
 *
 * Reads: hints.get(if.condition).constVal
 * Fires on: If where condition is const(true) or const(false)
 */
export class DeadBranchEliminationRule implements StmtTransformRule {
  readonly name = "dead-branch-elimination";
  readonly level = "stmt" as const;

  matches(stmt: StmtNS.Stmt, hints: HintTable): boolean {
    if (!(stmt instanceof StmtNS.If)) return false;
    const cv = hints.get(stmt.condition)?.constVal;
    return cv?.tag === "const" && typeof cv.value === "boolean";
  }

  apply(stmt: StmtNS.Stmt, hints: HintTable): StmtNS.Stmt[] {
    const ifStmt = stmt as StmtNS.If;
    const cv = hints.get(ifStmt.condition)!.constVal as ConstLattice & { tag: "const" };
    return cv.value ? ifStmt.body : (ifStmt.elseBlock ?? []);
  }
}
