/**
 * Tests PVMLCompiler's `useGlobalMap` mode ("REPL mode", as opposed to the
 * default fixed-slot "Pynter mode"): compile and run one chunk of code per
 * PVMLInterpreter instance, threading the same global environment (and the
 * accumulated set of module-level names, for the resolver) from one chunk to
 * the next — mirroring how PyCseEvaluatorBase keeps one persistent Context
 * across evaluateChunk() calls, but adapted to PVML's compiled/bytecode
 * pipeline instead of a tree-walking interpreter.
 *
 * `useGlobalMap` mode is what makes this possible at all: names declared at
 * module level compile to LDGG/STGG, backed by a dynamically-growable
 * name-indexed Map (PVMLInterpreter's globalEnv) instead of the usual
 * fixed-size-array module environment — a later chunk can introduce a global
 * a fixed-size array wouldn't have had room for, and a chunk's compiled
 * closures remain callable from a later, separately-compiled chunk (see
 * PVMLClosure's `ir` field, resolved once at closure-creation time rather
 * than re-looked-up via an index into "whichever program is currently
 * running").
 */
import { PVMLCompiler } from "../engines/pvml/pvml-compiler";
import { PVMLInterpreter } from "../engines/pvml/pvml-interpreter";
import { PVMLBoxType } from "../engines/pvml/types";
import { parse } from "../parser/parser-adapter";
import { analyzeWithEnvironments } from "../resolver";

function runChunk(
  code: string,
  globalEnv: Map<string, PVMLBoxType>,
): { result: unknown; globalEnv: Map<string, PVMLBoxType> } {
  const script = code.endsWith("\n") ? code : code + "\n";
  const ast = parse(script);
  const { errors, environments } = analyzeWithEnvironments(
    ast,
    script,
    4,
    [],
    [],
    Array.from(globalEnv.keys()),
  );
  if (errors.length > 0) {
    throw new Error("resolve errors: " + errors.map(e => e.message).join("; "));
  }
  const compiler = PVMLCompiler.fromProgram(ast, 4, environments, true);
  const program = compiler.compileProgram(ast);
  const interpreter = new PVMLInterpreter(program, { globalEnv });
  const result = PVMLInterpreter.toJSValue(interpreter.execute());
  return { result, globalEnv: interpreter.getGlobalEnv() };
}

describe("PVML REPL persistence (useGlobalMap mode)", () => {
  test("chunk 2 sees chunk 1's global variable and function", () => {
    let globalEnv = new Map<string, PVMLBoxType>();

    const r1 = runChunk("x = 5\ndef f():\n    return x + 1\n", globalEnv);
    globalEnv = r1.globalEnv;
    // Python `int` values are genuine bigints here (see PVMLType.BIGINT).
    expect(globalEnv.get("x")).toBe(5n);

    const r2 = runChunk("f()", globalEnv);
    expect(r2.result).toBe(6n);

    const r3 = runChunk("x = x + 10\nx", r2.globalEnv);
    expect(r3.result).toBe(15n);

    const r4 = runChunk("f()", r3.globalEnv);
    expect(r4.result).toBe(16n);
  });

  test("chunk 2 can define a new global the array model couldn't have pre-sized", () => {
    let globalEnv = new Map<string, PVMLBoxType>();
    const r1 = runChunk("a = 1\n", globalEnv);
    globalEnv = r1.globalEnv;
    const r2 = runChunk("b = 2\na + b", globalEnv);
    expect(r2.result).toBe(3n);
  });

  test("`global` from within a function still works across chunks", () => {
    let globalEnv = new Map<string, PVMLBoxType>();
    const r1 = runChunk("def set_y():\n    global y\n    y = 99\nset_y()\n", globalEnv);
    globalEnv = r1.globalEnv;
    const r2 = runChunk("y", globalEnv);
    expect(r2.result).toBe(99n);
  });

  test("nonlocal closures are unaffected by useGlobalMap mode", () => {
    const globalEnv = new Map<string, PVMLBoxType>();
    const r = runChunk(
      "def outer():\n    n = 0\n    def inc():\n        nonlocal n\n        n = n + 1\n    inc()\n    inc()\n    return n\nouter()",
      globalEnv,
    );
    expect(r.result).toBe(2n);
  });
});
