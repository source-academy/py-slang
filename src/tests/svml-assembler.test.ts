import { assemble, disassemble } from "../engines/svml/svml-assembler";
import { SVMLCompiler } from "../engines/svml/svml-compiler";
import { SVMLInterpreter } from "../engines/svml/svml-interpreter";
import { parse } from "../parser/parser-adapter";

function compileAndAssemble(code: string): Uint8Array {
  const ast = parse(code);
  const program = SVMLCompiler.fromProgram(ast).compileProgram(ast);
  return assemble(program);
}

function roundTrip(code: string): unknown {
  const binary = compileAndAssemble(code);
  const program = disassemble(binary);
  return SVMLInterpreter.toJSValue(new SVMLInterpreter(program).execute());
}

describe("SVML assembler", () => {
  describe("binary output", () => {
    test("produces a non-empty Uint8Array", () => {
      const binary = compileAndAssemble("1 + 1\n");
      expect(binary).toBeInstanceOf(Uint8Array);
      expect(binary.byteLength).toBeGreaterThan(0);
    });

    test("deterministic: same source produces identical bytes", () => {
      const a = compileAndAssemble("42\n");
      const b = compileAndAssemble("42\n");
      expect(Array.from(a)).toEqual(Array.from(b));
    });

    test("does not throw for a for-loop program (regression: FOR_ITER was opcode 1054)", () => {
      expect(() => compileAndAssemble("for i in range(3):\n    i\n")).not.toThrow();
    });
  });

  describe("disassemble round-trip", () => {
    test("function count is preserved", () => {
      const ast = parse("def f(x):\n    return x\nf(1)\n");
      const program = SVMLCompiler.fromProgram(ast).compileProgram(ast);
      expect(disassemble(assemble(program)).functions.length).toBe(program.functions.length);
    });

    test("integer arithmetic", () => {
      expect(roundTrip("3 + 4\n")).toBe(7);
    });

    test("boolean expression", () => {
      expect(roundTrip("1 < 2\n")).toBe(true);
    });

    test("conditional branch targets", () => {
      expect(roundTrip("x = 10\nif x > 5:\n    x = 1\nelse:\n    x = 2\nx\n")).toBe(1);
    });

    test("function definition and call", () => {
      expect(roundTrip("def f(x):\n    return x + 1\nf(41)\n")).toBe(42);
    });

    test("for-loop over range(n)", () => {
      const code = `
total = 0
for i in range(5):
    total = total + i
total
`;
      expect(roundTrip(code)).toBe(10);
    });

    test("for-loop over range(start, stop, step)", () => {
      const code = `
total = 0
for i in range(0, 10, 2):
    total = total + i
total
`;
      expect(roundTrip(code)).toBe(20);
    });

    test("for-loop over list literal", () => {
      const code = `
last = 0
for x in [10, 20, 30]:
    last = x
last
`;
      expect(roundTrip(code)).toBe(30);
    });

    test("nested for-loops", () => {
      const code = `
total = 0
for i in range(3):
    for j in range(3):
        total = total + 1
total
`;
      expect(roundTrip(code)).toBe(9);
    });

    test("for-loop over empty range", () => {
      expect(roundTrip("for i in range(0):\n    i\n")).toBeUndefined();
    });

    test("float64 literal round-trips correctly", () => {
      expect(roundTrip("3.141592653589793\n")).toBeCloseTo(3.141592653589793, 10);
    });

    test("multiple distinct string constants are preserved", () => {
      expect(roundTrip('"hello" + " world"\n')).toBe("hello world");
    });

    test("duplicate string constants deduplicate in binary", () => {
      // "x" + "x" stores one constant; "x" + "y" stores two — binary must be smaller.
      const withDupe = compileAndAssemble('"x" + "x"\n');
      const withUnique = compileAndAssemble('"x" + "y"\n');
      expect(withDupe.byteLength).toBeLessThan(withUnique.byteLength);
      expect(roundTrip('"x" + "x"\n')).toBe("xx");
    });
  });

  describe("disassemble error paths", () => {
    test("bad magic number throws", () => {
      const bad = new Uint8Array(32);
      new DataView(bad.buffer).setUint32(0, 0xdeadbeef, true);
      expect(() => disassemble(bad)).toThrow(/magic/i);
    });

    test("wrong version throws", () => {
      const good = compileAndAssemble("1\n");
      const patched = new Uint8Array(good);
      new DataView(patched.buffer).setUint16(4, 99, true); // major version = 99
      expect(() => disassemble(patched)).toThrow(/version/i);
    });

    test("truncated binary throws", () => {
      const good = compileAndAssemble("1\n");
      expect(() => disassemble(good.slice(0, 4))).toThrow();
    });
  });
});
