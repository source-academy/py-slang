/**
 * Tests for the ConstLattice / ConstAnalysisModule (Phase 3).
 *
 * Verifies:
 *  1. Lattice operations are correct (leq, join, meet)
 *  2. x = 3 + 4 produces constVal = const(7) on the BinOp node  [spec requirement]
 *  3. Two analyses coexist in the same HintTable (type + constVal on the same node)
 *  4. runMultiAnalysisPasses converges on a while loop (terminates)
 *  5. Variable propagation: x = 5; y = x + 2 → constVal const(7) on x+2
 */

import { parse } from "../parser/parser-adapter";
import { analyzeWithEnvironments } from "../resolver";
import { SVMLCompiler } from "../engines/svml/svml-compiler";
import { StmtNS } from "../ast-types";
import { runAnalysisPass, runMultiAnalysisPasses, MutableEnv } from "../specialization/dfa-driver";
import { TypeAnalysisModule } from "../specialization/type-analysis";
import { ConstAnalysisModule, constLeq, constJoin, constMeet } from "../specialization/const-analysis";
import type { HintTable } from "../specialization/analysis-module";
import { CONST_BOTTOM, CONST_TOP, constOf } from "../specialization/analysis-module";
import { INT_BIT } from "../types/abstract-value";

// ── Helpers ───────────────────────────────────────────────────────────────────

function analyseConst(code: string): { hints: HintTable; ast: StmtNS.FileInput; compiler: SVMLCompiler } {
  const script = code + "\n";
  const ast = parse(script);
  const { environments } = analyzeWithEnvironments(ast, script, 4);
  const compiler = SVMLCompiler.fromProgram(ast, environments);
  const hints: HintTable = new WeakMap();
  runAnalysisPass(ast.statements, new ConstAnalysisModule(), new MutableEnv(), hints, compiler.createSlotLookup());
  return { hints, ast, compiler };
}

function analyseBoth(code: string): { hints: HintTable; ast: StmtNS.FileInput; compiler: SVMLCompiler } {
  const script = code + "\n";
  const ast = parse(script);
  const { environments } = analyzeWithEnvironments(ast, script, 4);
  const compiler = SVMLCompiler.fromProgram(ast, environments);
  const hints: HintTable = new WeakMap();
  runMultiAnalysisPasses(
    ast.statements,
    [
      { module: new TypeAnalysisModule(),  env: new MutableEnv() },
      { module: new ConstAnalysisModule(), env: new MutableEnv() },
    ],
    hints,
    compiler.createSlotLookup(),
  );
  return { hints, ast, compiler };
}

// ── 1. Lattice unit tests ─────────────────────────────────────────────────────

describe("ConstLattice operations", () => {
  const c3 = constOf(3);
  const c7 = constOf(7);

  describe("constLeq", () => {
    test("bottom ≤ everything", () => {
      expect(constLeq(CONST_BOTTOM, CONST_BOTTOM)).toBe(true);
      expect(constLeq(CONST_BOTTOM, c3)).toBe(true);
      expect(constLeq(CONST_BOTTOM, CONST_TOP)).toBe(true);
    });
    test("everything ≤ top", () => {
      expect(constLeq(CONST_TOP,    CONST_TOP)).toBe(true);
      expect(constLeq(c3,           CONST_TOP)).toBe(true);
      expect(constLeq(CONST_BOTTOM, CONST_TOP)).toBe(true);
    });
    test("const(v) ≤ const(v) for same value", () => {
      expect(constLeq(c3, c3)).toBe(true);
      expect(constLeq(c3, constOf(3))).toBe(true);
    });
    test("const(v) ≰ const(w) for v ≠ w", () => {
      expect(constLeq(c3, c7)).toBe(false);
    });
    test("top ≰ bottom or const", () => {
      expect(constLeq(CONST_TOP, CONST_BOTTOM)).toBe(false);
      expect(constLeq(CONST_TOP, c3)).toBe(false);
    });
  });

  describe("constJoin (LUB)", () => {
    test("join(bottom, x) = x", () => {
      expect(constJoin(CONST_BOTTOM, c3)).toEqual(c3);
      expect(constJoin(CONST_BOTTOM, CONST_TOP)).toEqual(CONST_TOP);
      expect(constJoin(CONST_BOTTOM, CONST_BOTTOM)).toEqual(CONST_BOTTOM);
    });
    test("join(top, x) = top", () => {
      expect(constJoin(CONST_TOP, c3)).toEqual(CONST_TOP);
      expect(constJoin(c3, CONST_TOP)).toEqual(CONST_TOP);
    });
    test("join(const(v), const(v)) = const(v)", () => {
      expect(constJoin(c3, constOf(3))).toEqual(c3);
    });
    test("join(const(v), const(w)) = top when v ≠ w", () => {
      expect(constJoin(c3, c7)).toEqual(CONST_TOP);
    });
  });

  describe("constMeet (GLB)", () => {
    test("meet(top, x) = x", () => {
      expect(constMeet(CONST_TOP, c3)).toEqual(c3);
      expect(constMeet(c3, CONST_TOP)).toEqual(c3);
    });
    test("meet(bottom, x) = bottom", () => {
      expect(constMeet(CONST_BOTTOM, c3)).toEqual(CONST_BOTTOM);
      expect(constMeet(c3, CONST_BOTTOM)).toEqual(CONST_BOTTOM);
    });
    test("meet(const(v), const(v)) = const(v)", () => {
      expect(constMeet(c3, constOf(3))).toEqual(c3);
    });
    test("meet(const(v), const(w)) = bottom when v ≠ w", () => {
      expect(constMeet(c3, c7)).toEqual(CONST_BOTTOM);
    });
  });
});

// ── 2. Spec-required test: x = 3 + 4 → constVal = const(7) ──────────────────

describe("ConstAnalysisModule — BinOp folding", () => {
  test("x = 3 + 4 produces constVal = const(7) on the BinOp node", () => {
    const { hints, ast } = analyseConst("x = 3 + 4");
    const binExpr = (ast.statements[0] as any).value;
    const hint = hints.get(binExpr);
    expect(hint?.constVal?.tag).toBe("const");
    expect((hint?.constVal as any)?.value).toBe(7);
  });

  test("literal 3 annotated as const(3)", () => {
    const { hints, ast } = analyseConst("x = 3 + 4");
    const binExpr = (ast.statements[0] as any).value;
    const litHint = hints.get(binExpr.left);
    expect(litHint?.constVal?.tag).toBe("const");
    expect((litHint?.constVal as any)?.value).toBe(3);
  });

  test("int arithmetic ops fold correctly", () => {
    const cases: [string, number][] = [
      ["10 - 3",  7],
      ["3 * 4",  12],
      ["10 / 4",  2.5],
      ["7 // 2",  3],
      ["10 % 3",  1],
    ];
    for (const [expr, expected] of cases) {
      const { hints, ast } = analyseConst(`z = ${expr}`);
      const binNode = (ast.statements[0] as any).value;
      const h = hints.get(binNode);
      expect(h?.constVal?.tag).toBe("const");
      expect((h?.constVal as any)?.value).toBeCloseTo(expected);
    }
  });

  test("Python modulo: -7 % 3 = 2 (same sign as divisor)", () => {
    const { hints, ast } = analyseConst("z = -7 % 3");
    const binNode = (ast.statements[0] as any).value;
    const h = hints.get(binNode);
    expect(h?.constVal?.tag).toBe("const");
    expect((h?.constVal as any)?.value).toBe(2);
  });
});

// ── 3. Two analyses coexist on the same node ──────────────────────────────────

describe("runMultiAnalysisPasses — product lattice coexistence", () => {
  test("x = 3 + 4: BinOp has both type (INT_BIT) and constVal (const 7)", () => {
    const { hints, ast } = analyseBoth("x = 3 + 4");
    const binExpr = (ast.statements[0] as any).value;
    const hint = hints.get(binExpr);
    expect(hint?.type?.sound.kinds).toBe(INT_BIT);
    expect(hint?.constVal?.tag).toBe("const");
    expect((hint?.constVal as any)?.value).toBe(7);
  });

  test("convergence: completes without hanging on a while loop", () => {
    expect(() => analyseBoth("x = 1\nwhile x > 0:\n    x = x + 1")).not.toThrow();
  });
});

// ── 4. Variable propagation ───────────────────────────────────────────────────

describe("ConstAnalysisModule — variable propagation", () => {
  test("x = 5; y = x + 2 → constVal = const(7) on x+2", () => {
    const { hints, ast } = analyseConst("x = 5\ny = x + 2");
    const binExpr = (ast.statements[1] as any).value;
    const hint = hints.get(binExpr);
    expect(hint?.constVal?.tag).toBe("const");
    expect((hint?.constVal as any)?.value).toBe(7);
  });

  test("x = 0; if x > 0 → condition annotated as const(false)", () => {
    // x is const(0) at the if, so 0 > 0 folds to false
    const { hints, ast } = analyseConst("x = 0\nif x > 0:\n    x = 1\nelse:\n    x = 2");
    const condition = (ast.statements[1] as any).condition;
    const h = hints.get(condition);
    expect(h?.constVal?.tag).toBe("const");
    expect((h?.constVal as any)?.value).toBe(false);
  });
});
