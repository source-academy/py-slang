import { assemble, disassemble } from "../engines/pvml/pvml-assembler";
import { PVMLCompiler } from "../engines/pvml/pvml-compiler";
import { PVMLInterpreter } from "../engines/pvml/pvml-interpreter";
import { parse } from "../parser/parser-adapter";

function compileAndAssemble(code: string): Uint8Array {
  const ast = parse(code);
  // This suite exercises the serialised binary format itself, which can't carry
  // arbitrary-precision int literals (LGCBI) — see PVMLCompiler's `targetsPynter`.
  const program = PVMLCompiler.fromProgram(ast, 4, undefined, false, true).compileProgram(ast);
  return assemble(program);
}

/** A Python script has no return value of its own (see pvml-compiler.ts's
 * visitFileInputStmt doc comment), so — like pvml-interpreter.test.ts's
 * compileAndRun — this observes a value by capturing what the (already
 * disassembled and re-executed) program print()s, not by inspecting
 * execute()'s own return value. */
function roundTrip(code: string): string[] {
  const binary = compileAndAssemble(code);
  const program = disassemble(binary);
  const outputs: string[] = [];
  const interpreter = new PVMLInterpreter(program, { sendOutput: msg => outputs.push(msg) });
  interpreter.execute();
  return outputs;
}

describe("PVML assembler", () => {
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
      const program = PVMLCompiler.fromProgram(ast, 4, undefined, false, true).compileProgram(ast);
      expect(disassemble(assemble(program)).functions.length).toBe(program.functions.length);
    });

    // targetsPynter mode can't carry arbitrary-precision int literals (LGCBI, see
    // compileAndAssemble's own comment above) -- int literals compile as float64 (LGCF64)
    // instead, matching native Pynter's own NaN-boxed-double numeric model, so every int-valued
    // result here genuinely prints as N.0, not N.
    test("integer arithmetic", () => {
      expect(roundTrip("print(3 + 4)\n")).toEqual(["7.0"]);
    });

    test("boolean expression", () => {
      expect(roundTrip("print(1 < 2)\n")).toEqual(["True"]);
    });

    test("conditional branch targets", () => {
      expect(roundTrip("x = 10\nif x > 5:\n    x = 1\nelse:\n    x = 2\nprint(x)\n")).toEqual([
        "1.0",
      ]);
    });

    test("function definition and call", () => {
      expect(roundTrip("def f(x):\n    return x + 1\nprint(f(41))\n")).toEqual(["42.0"]);
    });

    test("for-loop over range(n)", () => {
      const code = `
total = 0
for i in range(5):
    total = total + i
print(total)
`;
      expect(roundTrip(code)).toEqual(["10.0"]);
    });

    test("for-loop over range(start, stop, step)", () => {
      const code = `
total = 0
for i in range(0, 10, 2):
    total = total + i
print(total)
`;
      expect(roundTrip(code)).toEqual(["20.0"]);
    });

    test("for-loop over list literal", () => {
      const code = `
last = 0
for x in [10, 20, 30]:
    last = x
print(last)
`;
      expect(roundTrip(code)).toEqual(["30.0"]);
    });

    test("nested for-loops", () => {
      const code = `
total = 0
for i in range(3):
    for j in range(3):
        total = total + 1
print(total)
`;
      expect(roundTrip(code)).toEqual(["9.0"]);
    });

    test("for-loop over empty range produces no output", () => {
      expect(roundTrip("for i in range(0):\n    i\n")).toEqual([]);
    });

    test("float64 literal round-trips correctly", () => {
      expect(roundTrip("print(3.141592653589793)\n")).toEqual(["3.141592653589793"]);
    });

    test("multiple distinct string constants are preserved", () => {
      expect(roundTrip('print("hello" + " world")\n')).toEqual(["hello world"]);
    });

    test("duplicate string constants deduplicate in binary", () => {
      // "x" + "x" stores one constant; "x" + "y" stores two — binary must be smaller.
      const withDupe = compileAndAssemble('"x" + "x"\n');
      const withUnique = compileAndAssemble('"x" + "y"\n');
      expect(withDupe.byteLength).toBeLessThan(withUnique.byteLength);
      expect(roundTrip('print("x" + "x")\n')).toEqual(["xx"]);
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

  // These opcodes are structurally nullary (no operand, unlike LGCBI/LGCC's
  // constant-pool index) and so *could* be encoded — but a program using
  // them always also uses LGCBI for its int literals, which already can't
  // be serialised, and targetsPynter mode rejects them outright at compile
  // time — so assemble() defends explicitly anyway (see pvml-assembler.ts),
  // rather than silently succeeding for an opcode that only "happens" to
  // have nothing to encode.
  describe("browser-pathway-only opcodes are rejected by assemble()/disassemble()", () => {
    test("CALLA/CALLTA (spread calls) cannot be assembled", () => {
      const ast = parse("def f(a, b, c):\n    return a + b + c\nxs = [1, 2, 3]\nf(*xs)\n");
      // Not targetsPynter here — compiling for the browser target so the
      // program actually contains CALLA to try to assemble.
      const program = PVMLCompiler.fromProgram(ast, 4).compileProgram(ast);
      expect(() => assemble(program)).toThrow();
    });
  });
});
