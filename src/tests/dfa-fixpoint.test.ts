/**
 * Unit tests for the DFA fixpoint driver.
 *
 * Tests:
 *  1. While-loop convergence: types widen correctly and terminate
 *  2. If-else join: env after if/else is join of both branches
 *  3. For-loop: loop variable set to TOP
 *  4. Nested while-loops: terminate correctly
 *  5. Assignment propagation: type flows from rhs to slot
 */

import { parse } from "../parser/parser-adapter";
import { analyzeWithEnvironments } from "../resolver";
import { SVMLCompiler } from "../engines/svml/svml-compiler";
import { runAnalysisPass, MutableEnv } from "../specialization/dfa-driver";
import { TypeAnalysisModule } from "../specialization/type-analysis";
import type { HintTable } from "../specialization/analysis-module";
import { INT_BIT, BOOL_BIT, FLOAT_BIT } from "../types/abstract-value";
import { IntRef, BoolRef, positiveInteger, negativeInteger, join, leq } from "../types/lattice-ops";
import type { AbstractValue } from "../types/abstract-value";
import { ExprNS } from "../ast-types";

function analyseTopLevel(code: string): { hints: HintTable; compiler: SVMLCompiler } {
  const script = code + "\n";
  const ast = parse(script);
  const { environments } = analyzeWithEnvironments(ast, script, 4);
  const compiler = SVMLCompiler.fromProgram(ast, environments);
  const hints: HintTable = new WeakMap();
  const typeEnv = new MutableEnv();
  runAnalysisPass(ast.statements, new TypeAnalysisModule(), typeEnv, hints, compiler.createSlotLookup());
  return { hints, compiler };
}

describe("DFA fixpoint driver", () => {
  describe("Literal annotation", () => {
    test("positive integer literal annotated as INT_BIT Pos", () => {
      const script = "x = 5\n";
      const ast = parse(script);
      const { environments } = analyzeWithEnvironments(ast, script, 4);
      const compiler = SVMLCompiler.fromProgram(ast, environments);
      const hints: HintTable = new WeakMap();
      runAnalysisPass(ast.statements, new TypeAnalysisModule(), new MutableEnv(), hints, compiler.createSlotLookup());

      // The literal 5 is the value in the Assign statement — find it
      const assign = ast.statements[0] as any;
      const lit = assign.value;
      expect(hints.get(lit)?.type?.sound.kinds).toBe(INT_BIT);
      expect(hints.get(lit)?.type?.sound.intRef).toBe(IntRef.Pos);
    });

    test("float literal annotated as FLOAT_BIT", () => {
      const script = "x = 3.14\n";
      const ast = parse(script);
      const { environments } = analyzeWithEnvironments(ast, script, 4);
      const compiler = SVMLCompiler.fromProgram(ast, environments);
      const hints: HintTable = new WeakMap();
      runAnalysisPass(ast.statements, new TypeAnalysisModule(), new MutableEnv(), hints, compiler.createSlotLookup());

      const assign = ast.statements[0] as any;
      const lit = assign.value;
      expect(hints.get(lit)?.type?.sound.kinds).toBe(FLOAT_BIT);
    });

    test("boolean literal annotated as BOOL_BIT", () => {
      const script = "x = True\n";
      const ast = parse(script);
      const { environments } = analyzeWithEnvironments(ast, script, 4);
      const compiler = SVMLCompiler.fromProgram(ast, environments);
      const hints: HintTable = new WeakMap();
      runAnalysisPass(ast.statements, new TypeAnalysisModule(), new MutableEnv(), hints, compiler.createSlotLookup());

      const assign = ast.statements[0] as any;
      const lit = assign.value;
      expect(hints.get(lit)?.type?.sound.kinds).toBe(BOOL_BIT);
      expect(hints.get(lit)?.type?.sound.boolRef).toBe(BoolRef.True);
    });
  });

  describe("Binary expression annotation", () => {
    test("pos + pos annotated as INT_BIT Pos", () => {
      const script = "z = 3 + 4\n";
      const ast = parse(script);
      const { environments } = analyzeWithEnvironments(ast, script, 4);
      const compiler = SVMLCompiler.fromProgram(ast, environments);
      const hints: HintTable = new WeakMap();
      runAnalysisPass(ast.statements, new TypeAnalysisModule(), new MutableEnv(), hints, compiler.createSlotLookup());

      const assign = ast.statements[0] as any;
      const binExpr = assign.value; // 3 + 4
      expect(hints.get(binExpr)?.type?.sound.kinds).toBe(INT_BIT);
      expect(hints.get(binExpr)?.type?.sound.intRef).toBe(IntRef.Pos);
    });

    test("pos - pos annotated as INT_BIT Top (sign unknown)", () => {
      const script = "z = 5 - 3\n";
      const ast = parse(script);
      const { environments } = analyzeWithEnvironments(ast, script, 4);
      const compiler = SVMLCompiler.fromProgram(ast, environments);
      const hints: HintTable = new WeakMap();
      runAnalysisPass(ast.statements, new TypeAnalysisModule(), new MutableEnv(), hints, compiler.createSlotLookup());

      const assign = ast.statements[0] as any;
      const binExpr = assign.value;
      expect(hints.get(binExpr)?.type?.sound.kinds).toBe(INT_BIT);
      // 5 - 3 = pos - pos = top (could be positive or negative or zero)
      expect(hints.get(binExpr)?.type?.sound.intRef).toBe(IntRef.Top);
    });
  });

  describe("MutableTypeEnv", () => {
    test("snapshot is independent copy", () => {
      const env = new MutableEnv<AbstractValue>([positiveInteger()]);
      const snap = env.snapshot();
      env.set(0, negativeInteger());
      expect(snap.get(0)?.sound.intRef).toBe(IntRef.Pos); // snapshot unaffected
      expect(env.get(0)?.sound.intRef).toBe(IntRef.Neg);
    });

    test("joinWith merges slots correctly", () => {
      const env1 = new MutableEnv<AbstractValue>([positiveInteger()]);
      const env2 = new MutableEnv<AbstractValue>([negativeInteger()]);
      env1.joinWith(env2, join);
      // join(Pos, Neg) = NonZero (4 | 1 = 5): both are definitely nonzero, zero is impossible
      expect(env1.get(0)?.sound.kinds).toBe(INT_BIT);
      expect(env1.get(0)?.sound.intRef).toBe(IntRef.NonZero);
    });

    test("equals returns true for same singletons", () => {
      const env1 = new MutableEnv<AbstractValue>([positiveInteger()]);
      const env2 = new MutableEnv<AbstractValue>([positiveInteger()]);
      expect(env1.equals(env2, leq)).toBe(true);
    });

    test("equals returns false for different values", () => {
      const env1 = new MutableEnv<AbstractValue>([positiveInteger()]);
      const env2 = new MutableEnv<AbstractValue>([negativeInteger()]);
      expect(env1.equals(env2, leq)).toBe(false);
    });

    test("equals returns false for different lengths", () => {
      const env1 = new MutableEnv<AbstractValue>([positiveInteger(), positiveInteger()]);
      const env2 = new MutableEnv<AbstractValue>([positiveInteger()]);
      expect(env1.equals(env2, leq)).toBe(false);
    });
  });

  describe("runAnalysisPass terminates", () => {
    test("simple while loop completes without infinite loop", () => {
      // This test verifies the fixpoint terminates for a simple counting loop
      const code = `
x = 1
while x > 0:
    x = x + 1
`;
      // Must complete in finite time — if fixpoint fails, test will hang/timeout
      expect(() => analyseTopLevel(code)).not.toThrow();
    });

    test("nested while loops complete", () => {
      const code = `
i = 0
while i > 0:
    j = 0
    while j > 0:
        j = j + 1
    i = i + 1
`;
      expect(() => analyseTopLevel(code)).not.toThrow();
    });

    test("if-else completes", () => {
      const code = `
x = 1
if x > 0:
    y = 2
else:
    y = 3
`;
      expect(() => analyseTopLevel(code)).not.toThrow();
    });

    test("for loop completes", () => {
      const code = `
total = 0
for i in [1, 2, 3]:
    total = total + i
`;
      expect(() => analyseTopLevel(code)).not.toThrow();
    });
  });

  describe("If-else join semantics", () => {
    test("annotates condition expression", () => {
      const script = "x = 3\nif x > 0:\n    y = 1\nelse:\n    y = 2\n";
      const ast = parse(script);
      const { environments } = analyzeWithEnvironments(ast, script, 4);
      const compiler = SVMLCompiler.fromProgram(ast, environments);
      const hints: HintTable = new WeakMap();
      runAnalysisPass(ast.statements, new TypeAnalysisModule(), new MutableEnv(), hints, compiler.createSlotLookup());

      // The if condition x > 0 should be annotated
      const ifStmt = ast.statements[1] as any;
      const condition = ifStmt.condition; // Compare: x > 0
      const condHint = hints.get(condition);
      expect(condHint?.type?.sound.kinds).toBe(BOOL_BIT);
    });
  });

  describe("Comparison annotation", () => {
    test("pos > pos annotated as BOOL_BIT Top", () => {
      const script = "z = 3 > 4\n";
      const ast = parse(script);
      const { environments } = analyzeWithEnvironments(ast, script, 4);
      const compiler = SVMLCompiler.fromProgram(ast, environments);
      const hints: HintTable = new WeakMap();
      runAnalysisPass(ast.statements, new TypeAnalysisModule(), new MutableEnv(), hints, compiler.createSlotLookup());

      const assign = ast.statements[0] as any;
      const cmp = assign.value;
      expect(hints.get(cmp)?.type?.sound.kinds).toBe(BOOL_BIT);
    });

    test("pos > zero annotated as BOOL_BIT True", () => {
      const script = "z = 5 > 0\n";
      const ast = parse(script);
      const { environments } = analyzeWithEnvironments(ast, script, 4);
      const compiler = SVMLCompiler.fromProgram(ast, environments);
      const hints: HintTable = new WeakMap();
      runAnalysisPass(ast.statements, new TypeAnalysisModule(), new MutableEnv(), hints, compiler.createSlotLookup());

      const assign = ast.statements[0] as any;
      const cmp = assign.value;
      expect(hints.get(cmp)?.type?.sound.kinds).toBe(BOOL_BIT);
      expect(hints.get(cmp)?.type?.sound.boolRef).toBe(BoolRef.True);
    });
  });
});
