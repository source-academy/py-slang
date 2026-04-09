/**
 * Tests for Phase 4: transformation rules and stabilizeStatic.
 *
 * Verifies:
 *  1. Dead branch — True condition: If collapses to then-body
 *  2. Dead branch — False condition: If collapses to else-body
 *  3. Dead branch — False, no else: statement deleted
 *  4. Constant folding: 1 + 2 → Literal(3)
 *  5. Constant folding — nested: 1 + 2 + 3 → Literal(6) (bottom-up)
 *  6. No infinite loop: stabilizeStatic returns on code with no applicable rules
 *  7. Compound: if True: x = 1 + 2 else: x = 99 → x = 3
 */

import { parse } from "../parser/parser-adapter";
import { analyzeWithEnvironments } from "../resolver";
import { SVMLCompiler } from "../engines/svml/svml-compiler";
import { ExprNS, StmtNS } from "../ast-types";
import { stabilizeStatic } from "../specialization/dfa-driver";
import { TypeAnalysisModule } from "../specialization/type-analysis";
import { ConstAnalysisModule } from "../specialization/const-analysis";
import { ConstantFoldingRule, DeadBranchEliminationRule } from "../specialization/transform-rules";
import type { HintTable } from "../specialization/analysis-module";

function optimise(code: string): StmtNS.Stmt[] {
  const script = code + "\n";
  const ast = parse(script);
  const { environments } = analyzeWithEnvironments(ast, script, 4);
  const compiler = SVMLCompiler.fromProgram(ast, environments);
  const hints: HintTable = new WeakMap();
  stabilizeStatic(
    ast.statements,
    [new TypeAnalysisModule(), new ConstAnalysisModule()],
    [new DeadBranchEliminationRule(), new ConstantFoldingRule()],
    hints,
    compiler.createSlotLookup(),
  );
  return ast.statements;
}

describe("Phase 4: transformation rules", () => {
  describe("dead branch elimination", () => {
    test("True condition: collapses to then-body", () => {
      const stmts = optimise("if True:\n  x = 1\nelse:\n  x = 2");
      expect(stmts.length).toBe(1);
      const assign = stmts[0] as StmtNS.Assign;
      expect(assign).toBeInstanceOf(StmtNS.Assign);
      // Parser represents integer literals as strings; folding wasn't applied here
      expect((assign.value as ExprNS.Literal).value).toBe("1");
    });

    test("False condition: collapses to else-body", () => {
      const stmts = optimise("if False:\n  x = 1\nelse:\n  x = 2");
      expect(stmts.length).toBe(1);
      const assign = stmts[0] as StmtNS.Assign;
      expect(assign).toBeInstanceOf(StmtNS.Assign);
      expect((assign.value as ExprNS.Literal).value).toBe("2");
    });

    test("False condition, no else: statement deleted", () => {
      const stmts = optimise("if False:\n  x = 1");
      expect(stmts.length).toBe(0);
    });
  });

  describe("constant folding", () => {
    test("1 + 2 folds to Literal(3)", () => {
      const stmts = optimise("x = 1 + 2");
      expect(stmts.length).toBe(1);
      const assign = stmts[0] as StmtNS.Assign;
      expect(assign).toBeInstanceOf(StmtNS.Assign);
      const lit = assign.value as ExprNS.Literal;
      expect(lit).toBeInstanceOf(ExprNS.Literal);
      expect(lit.value).toBe(3);
    });

    test("nested: 1 + 2 + 3 folds to Literal(6)", () => {
      const stmts = optimise("x = 1 + 2 + 3");
      expect(stmts.length).toBe(1);
      const assign = stmts[0] as StmtNS.Assign;
      const lit = assign.value as ExprNS.Literal;
      expect(lit).toBeInstanceOf(ExprNS.Literal);
      expect(lit.value).toBe(6);
    });
  });

  describe("stabilizeStatic", () => {
    test("no applicable rules: returns without hitting maxIterations", () => {
      // No transform applies to plain assignments with distinct values — should not loop
      const stmts = optimise("x = 1\ny = 2");
      expect(stmts.length).toBe(2);
    });

    test("compound: if True: x = 1 + 2 else: x = 99 → x = 3", () => {
      const stmts = optimise("if True:\n  x = 1 + 2\nelse:\n  x = 99");
      expect(stmts.length).toBe(1);
      const assign = stmts[0] as StmtNS.Assign;
      expect(assign).toBeInstanceOf(StmtNS.Assign);
      const lit = assign.value as ExprNS.Literal;
      expect(lit).toBeInstanceOf(ExprNS.Literal);
      expect(lit.value).toBe(3);
    });
  });
});
