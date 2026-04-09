/**
 * Integration tests for specialized opcode selection via static type analysis.
 *
 * These tests verify that the DFA type analysis produces correct results when
 * compiled with specialized opcodes. Tests cover expressions where operand types
 * are statically determinable from literals at the top level.
 *
 * Note: Function-level specialization (seeding parameter types from call-site
 * arguments) requires inter-procedural analysis, which is deferred to a follow-up
 * PR. These tests cover top-level code where types are directly visible.
 */
import { parse } from "../parser/parser-adapter";
import { analyzeWithEnvironments } from "../resolver";
import { SVMLCompiler } from "../engines/svml/svml-compiler";
import { SVMLInterpreter } from "../engines/svml/svml-interpreter";
import { runAnalysisPass, MutableEnv } from "../specialization/dfa-driver";
import { TypeAnalysisModule } from "../specialization/type-analysis";
import type { HintTable } from "../specialization/analysis-module";

/**
 * Compile and run with DFA type analysis enabled.
 * Specialized opcodes are selected when types are statically known.
 */
function compileAndRunSpecialized(code: string): unknown {
  const script = code + "\n";
  const ast = parse(script);
  const { errors, environments } = analyzeWithEnvironments(ast, script, 4);
  if (errors.length > 0) throw errors[0];

  const compiler = SVMLCompiler.fromProgram(ast, environments);
  const hints: HintTable = new WeakMap();
  const typeEnv = new MutableEnv();
  runAnalysisPass(ast.statements, new TypeAnalysisModule(), typeEnv, hints, compiler.createSlotLookup());
  compiler.setTypeHints(hints);

  const program = compiler.compileProgram(ast);
  const interpreter = new SVMLInterpreter(program);
  return SVMLInterpreter.toJSValue(interpreter.execute());
}

describe("Specialized opcode correctness (top-level static analysis)", () => {
  describe("Arithmetic with typed literals (ADDF, SUBF, MULF, DIVF, FLOORDIVF, MODF)", () => {
    test("int + int produces correct result", () => {
      expect(compileAndRunSpecialized("3 + 4")).toBe(7);
    });

    test("int - int produces correct result", () => {
      expect(compileAndRunSpecialized("10 - 3")).toBe(7);
    });

    test("int * int produces correct result", () => {
      expect(compileAndRunSpecialized("3 * 4")).toBe(12);
    });

    test("int / int produces float result", () => {
      expect(compileAndRunSpecialized("10 / 4")).toBe(2.5);
    });

    test("int // int (floor division) produces correct result", () => {
      expect(compileAndRunSpecialized("7 // 2")).toBe(3);
    });

    test("int % int produces correct remainder", () => {
      expect(compileAndRunSpecialized("10 % 3")).toBe(1);
    });

    test("negative int arithmetic", () => {
      expect(compileAndRunSpecialized("-3 * -4")).toBe(12);
    });
  });

  describe("Comparison with typed literals (LTF, GTF, LEF, GEF, EQF)", () => {
    test("int < int: 3 < 4 = True", () => {
      expect(compileAndRunSpecialized("3 < 4")).toBe(true);
    });

    test("int > int: 5 > 3 = True", () => {
      expect(compileAndRunSpecialized("5 > 3")).toBe(true);
    });

    test("int == int: 5 == 5 = True", () => {
      expect(compileAndRunSpecialized("5 == 5")).toBe(true);
    });

    test("int == int: 5 == 3 = False", () => {
      expect(compileAndRunSpecialized("5 == 3")).toBe(false);
    });

    test("int <= int: 3 <= 3 = True", () => {
      expect(compileAndRunSpecialized("3 <= 3")).toBe(true);
    });

    test("int >= int: 5 >= 6 = False", () => {
      expect(compileAndRunSpecialized("5 >= 6")).toBe(false);
    });
  });

  describe("Unary operators with typed operands (NEGF, NOTB)", () => {
    test("unary minus on positive int", () => {
      expect(compileAndRunSpecialized("-5")).toBe(-5);
    });

    test("not True = False", () => {
      expect(compileAndRunSpecialized("not True")).toBe(false);
    });

    test("not False = True", () => {
      expect(compileAndRunSpecialized("not False")).toBe(true);
    });
  });

  describe("Variable assignment and use", () => {
    test("assign int, use in arithmetic", () => {
      expect(compileAndRunSpecialized("x = 3\nx + 4")).toBe(7);
    });

    test("chained assignments", () => {
      expect(compileAndRunSpecialized("x = 10\ny = 3\nx - y")).toBe(7);
    });
  });

  describe("Correctness: specialized opcodes match generic semantics", () => {
    test("large integer arithmetic still correct", () => {
      expect(compileAndRunSpecialized("1000000 * 1000000")).toBe(1_000_000_000_000);
    });

    test("mixed precedence", () => {
      expect(compileAndRunSpecialized("2 + 3 * 4")).toBe(14);
    });

    test("if branch with typed condition", () => {
      const code = `
x = 5
y = 0
if x > 0:
    y = 1
else:
    y = 2
y
`;
      expect(compileAndRunSpecialized(code)).toBe(1);
    });

    test("function with literal-typed body (no inter-proc analysis yet)", () => {
      // Function defined but called with literals — function body uses TOP for params
      // but the call result is correct via generic opcodes
      const code = `
def add(x, y):
    return x + y
add(3, 4)
`;
      expect(compileAndRunSpecialized(code)).toBe(7);
    });

    test("recursive fibonacci still correct", () => {
      const code = `
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)
fib(10)
`;
      expect(compileAndRunSpecialized(code)).toBe(55);
    });
  });
});
