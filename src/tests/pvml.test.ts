/**
 * End-to-end tests for the PVML pipeline:
 *   Python source → parse → compile → interpret
 *
 * Uses the same TestCases tuple convention as stdlib.test.ts:
 *   [code, expectedValue, expectedOutput]
 */
import { UnsupportedOperandTypeError, ZeroDivisionError } from "../engines/pvml/errors";
import { PVMLCompiler } from "../engines/pvml/pvml-compiler";
import OpCodes from "../engines/pvml/opcodes";
import { parse } from "../parser/parser-adapter";
import { generatePVMLTestCases, PVMLTestCases } from "./utils";

/** The opcodes the entry function's compiled body contains, for compiler-only assertions
 * that don't require the interpreter to execute them (e.g. opcodes the interpreter doesn't
 * implement yet). */
function compiledEntryOpcodes(code: string, variant: number = 4): OpCodes[] {
  const ast = parse(code.endsWith("\n") ? code : code + "\n");
  const program = PVMLCompiler.fromProgram(ast, variant).compileProgram(ast);
  const entryFn = program.functions[program.entryPoint];
  return Array.from(entryFn.opcodes);
}

describe("PVML E2E", () => {
  const functionTests: PVMLTestCases = {
    "simple calls": [
      ["def add(x, y):\n    return x + y\nadd(3, 4)", 7, null],
      ["def noop():\n    pass\nnoop()", null, null],
      ["def f():\n    return\nf()", null, null],
    ],
    "nested and higher-order": [
      [
        "def outer(x):\n    def inner(y):\n        return x + y\n    return inner(10)\nouter(5)",
        15,
        null,
      ],
      [
        "def apply(f, x):\n    return f(x)\ndef double(n):\n    return n * 2\napply(double, 21)",
        42,
        null,
      ],
      ["def a(x):\n    return x + 1\ndef b(x):\n    return a(x) * 2\nb(4)", 10, null],
    ],
    closures: [
      [
        "def make_adder(n):\n    def add(x):\n        return x + n\n    return add\nadd3 = make_adder(3)\nadd3(7)",
        10,
        null,
      ],
      [
        "def make_multiplier(f):\n    def mul(x):\n        return x * f\n    return mul\ntriple = make_multiplier(3)\ntriple(5) + triple(10)",
        45,
        null,
      ],
    ],
    recursion: [
      [
        "def factorial(n):\n    if n <= 1:\n        return 1\n    else:\n        return n * factorial(n - 1)\nfactorial(6)",
        720,
        null,
      ],
      [
        "def fib(n):\n    if n <= 1:\n        return n\n    else:\n        return fib(n - 1) + fib(n - 2)\nfib(10)",
        55,
        null,
      ],
      [
        "def ack(m, n):\n    if m == 0:\n        return n + 1\n    else:\n        if n == 0:\n            return ack(m - 1, 1)\n        else:\n            return ack(m - 1, ack(m, n - 1))\nack(3, 4)",
        125,
        null,
      ],
    ],
    "mutual recursion": [
      [
        "def is_even(n):\n    if n == 0:\n        return True\n    else:\n        return is_odd(n - 1)\ndef is_odd(n):\n    if n == 0:\n        return False\n    else:\n        return is_even(n - 1)\nis_even(10)",
        true,
        null,
      ],
      [
        "def is_even(n):\n    if n == 0:\n        return True\n    else:\n        return is_odd(n - 1)\ndef is_odd(n):\n    if n == 0:\n        return False\n    else:\n        return is_even(n - 1)\nis_odd(7)",
        true,
        null,
      ],
    ],
    lambdas: [
      ["square = lambda x: x * x\nsquare(9)", 81, null],
      ["def apply(f, x):\n    return f(x)\napply(lambda x: x + 100, 5)", 105, null],
      ["multiply = lambda x, y: x * y\nmultiply(6, 7)", 42, null],
    ],
  };

  const branchTests: PVMLTestCases = {
    "if-else": [
      ["x = 10\nif x > 5:\n    result = 1\nelse:\n    result = 2\nresult", 1, null],
      ["x = 3\nif x > 5:\n    result = 1\nelse:\n    result = 2\nresult", 2, null],
      ["x = 0\nif True:\n    x = 42\nx", 42, null],
    ],
    "nested branches": [
      [
        'def classify(n):\n    if n > 0:\n        if n > 100:\n            return "big"\n        else:\n            return "small"\n    else:\n        if n == 0:\n            return "zero"\n        else:\n            return "negative"\nclassify(200)',
        "big",
        null,
      ],
      [
        'def classify(n):\n    if n > 0:\n        if n > 100:\n            return "big"\n        else:\n            return "small"\n    else:\n        if n == 0:\n            return "zero"\n        else:\n            return "negative"\nclassify(50)',
        "small",
        null,
      ],
      [
        'def classify(n):\n    if n > 0:\n        if n > 100:\n            return "big"\n        else:\n            return "small"\n    else:\n        if n == 0:\n            return "zero"\n        else:\n            return "negative"\nclassify(0)',
        "zero",
        null,
      ],
      [
        'def classify(n):\n    if n > 0:\n        if n > 100:\n            return "big"\n        else:\n            return "small"\n    else:\n        if n == 0:\n            return "zero"\n        else:\n            return "negative"\nclassify(-5)',
        "negative",
        null,
      ],
    ],
    "ternary and boolean ops": [
      ['"yes" if True else "no"', "yes", null],
      ['"yes" if False else "no"', "no", null],
      ["False and True", false, null],
      ["True and True", true, null],
      ["True or False", true, null],
      ["False or False", false, null],
    ],
    "branch with function call": [
      [
        'def is_positive(n):\n    return n > 0\nif is_positive(5):\n    result = "yes"\nelse:\n    result = "no"\nresult',
        "yes",
        null,
      ],
      [
        "def clamp(x, lo, hi):\n    if x < lo:\n        return lo\n    else:\n        if x > hi:\n            return hi\n        else:\n            return x\nclamp(-5, 0, 10)",
        0,
        null,
      ],
      [
        "def clamp(x, lo, hi):\n    if x < lo:\n        return lo\n    else:\n        if x > hi:\n            return hi\n        else:\n            return x\nclamp(15, 0, 10)",
        10,
        null,
      ],
    ],
  };

  const loopTests: PVMLTestCases = {
    "while loops": [
      ["i = 0\ntotal = 0\nwhile i < 5:\n    total = total + i\n    i = i + 1\ntotal", 10, null],
      ["i = 0\nwhile True:\n    if i == 7:\n        break\n    i = i + 1\ni", 7, null],
      [
        "total = 0\ni = 0\nwhile i < 6:\n    i = i + 1\n    if i == 3:\n        continue\n    total = total + i\ntotal",
        18,
        null,
      ],
    ],
    "for loops": [
      ["total = 0\nfor i in range(5):\n    total = total + i\ntotal", 10, null],
      ["total = 0\nfor i in range(1, 6):\n    total = total + i\ntotal", 15, null],
      ["total = 0\nfor i in range(0, 10, 2):\n    total = total + i\ntotal", 20, null],
      ["last = 0\nfor x in [10, 20, 30]:\n    last = x\nlast", 30, null],
      ["x = 42\nfor i in range(0):\n    x = 0\nx", 42, null],
    ],
    "break and continue": [
      [
        "result = 0\nfor i in range(100):\n    if i == 5:\n        break\n    result = result + i\nresult",
        10,
        null,
      ],
      [
        "total = 0\nfor i in range(6):\n    if i == 3:\n        continue\n    total = total + i\ntotal",
        12,
        null,
      ],
      [
        "total = 0\nfor i in range(3):\n    for j in range(10):\n        if j == 2:\n            break\n        total = total + 1\ntotal",
        6,
        null,
      ],
    ],
  };

  const combinedTests: PVMLTestCases = {
    "functions + branches": [
      [
        "def gcd(a, b):\n    if b == 0:\n        return a\n    else:\n        return gcd(b, a % b)\ngcd(48, 18)",
        6,
        null,
      ],
      [
        'def make_checker(t):\n    def check(x):\n        if x > t:\n            return "above"\n        else:\n            return "below"\n    return check\ncheck10 = make_checker(10)\ncheck10(15)',
        "above",
        null,
      ],
    ],
    "functions + loops": [
      [
        "def sum_evens(n):\n    total = 0\n    for i in range(n):\n        if i % 2 == 0:\n            total = total + i\n    return total\nsum_evens(10)",
        20,
        null,
      ],
      [
        "def power(base, exp):\n    result = 1\n    for i in range(exp):\n        result = result * base\n    return result\npower(2, 10)",
        1024,
        null,
      ],
    ],
    output: [
      ["for i in range(3):\n    print(i)", undefined, ["0", "1", "2"]],
      ['print("hello")', undefined, ["hello"]],
    ],
  };

  // `global`/`nonlocal` variable references resolve via the same environment-
  // chain machinery already exercised by closures/recursion above — see
  // resolver.ts's visitFunctionDefStmt, which pre-declares a `global`-declared
  // name in the module-level environment (not the outer builtins/prelude
  // environment) so a name with *no* top-level assignment at all still gets a
  // real variable slot there, rather than being mistaken for an unimplemented
  // primitive function.
  const globalNonlocalTests: PVMLTestCases = {
    global: [
      ["x = 0\ndef set_x():\n    global x\n    x = 42\nset_x()\nx", 42, null],
      ["def set_y():\n    global y\n    y = 99\nset_y()\ny", 99, null],
      [
        "def outer():\n    def inner():\n        global z\n        z = 7\n    inner()\nouter()\nz",
        7,
        null,
      ],
      [
        "def setter():\n    global w\n    w = 5\ndef getter():\n    global w\n    return w + 1\nsetter()\ngetter()",
        6,
        null,
      ],
      [
        "def bump():\n    global counter\n    counter = 0\n    counter = counter + 1\n    return counter\nbump()",
        1,
        null,
      ],
    ],
    nonlocal: [
      [
        "def outer():\n    n = 0\n    def inc():\n        nonlocal n\n        n = n + 1\n    inc()\n    inc()\n    return n\nouter()",
        2,
        null,
      ],
    ],
  };

  const errorTests: PVMLTestCases = {
    "type errors": [
      ['1 + ""', UnsupportedOperandTypeError, null],
      ["not 1", UnsupportedOperandTypeError, null],
      ["if 1:\n    10\nelse:\n    20", UnsupportedOperandTypeError, null],
    ],
    "arithmetic errors": [
      ["1 / 0", ZeroDivisionError, null],
      ["1 // 0", ZeroDivisionError, null],
      ["1 % 0", ZeroDivisionError, null],
    ],
  };

  describe("Functions", () => generatePVMLTestCases(functionTests));
  describe("Branches", () => generatePVMLTestCases(branchTests));
  describe("Loops", () => generatePVMLTestCases(loopTests));
  describe("Combined", () => generatePVMLTestCases(combinedTests));
  describe("Global / Nonlocal", () => generatePVMLTestCases(globalNonlocalTests));
  describe("Errors", () => generatePVMLTestCases(errorTests));

  // `is`/`is not` compile to their own EQP/NEQP opcodes, distinct from `==`/`!=`'s
  // EQG/NEQG (see pvml-compiler.ts's getCompareOpCode) — `is`/`is not` test Python
  // pointer/identity equality, a different question from `==`/`!=`'s structural
  // equality.
  describe("Compiler: is / is not opcodes", () => {
    test("`is` compiles to EQP, not EQG", () => {
      expect(compiledEntryOpcodes("1 is 1")).toContain(OpCodes.EQP);
      expect(compiledEntryOpcodes("1 is 1")).not.toContain(OpCodes.EQG);
    });

    test("`is not` compiles to NEQP, not NEQG", () => {
      expect(compiledEntryOpcodes("1 is not 1")).toContain(OpCodes.NEQP);
      expect(compiledEntryOpcodes("1 is not 1")).not.toContain(OpCodes.NEQG);
    });

    test("`==`/`!=` still compile to EQG/NEQG, not EQP/NEQP", () => {
      expect(compiledEntryOpcodes("1 == 1")).toContain(OpCodes.EQG);
      expect(compiledEntryOpcodes("1 == 1")).not.toContain(OpCodes.EQP);
      expect(compiledEntryOpcodes("1 != 1")).toContain(OpCodes.NEQG);
      expect(compiledEntryOpcodes("1 != 1")).not.toContain(OpCodes.NEQP);
    });
  });

  const identityTests: PVMLTestCases = {
    "is / is not": [
      ["None is None", true, null],
      ["None is not None", false, null],
      ["1 is 1", true, null],
      ["True is True", true, null],
      ["1 is True", false, null],
      // Real Python: false (int and float are distinct types, so `is` should
      // never treat them as identical, even at equal value). PVML doesn't
      // distinguish int from float at the *value* level, unlike the CSE
      // machine's bigint/number split — both compile to a plain JS `number`
      // at runtime, so they're indistinguishable to `is` here. A known,
      // pre-existing representation gap, not something this change touches.
      ["1 is 1.0", true, null],
      ["x = [1, 2]\ny = x\nx is y", true, null],
      ["[1, 2] is [1, 2]", false, null],
      ["f = lambda x: x\ng = f\nf is g", true, null],
      ["(lambda x: x) is (lambda x: x)", false, null],
      ["1 is not 2", true, null],
    ],
  };

  describe("Identity (is / is not)", () => generatePVMLTestCases(identityTests));

  // `==`/`!=`/ordering compile to a different opcode family per chapter (see
  // pvml-compiler.ts's getCompareOpCode): §1/§2 reject bool operands outright
  // (EQG12/NEQG12/LTG12/GTG12/LEG12/GEG12), §3/§4 let bool participate as the
  // int it is (EQG/NEQG/LTG/GTG/LEG/GEG) — the interpreter itself never has to
  // ask which chapter compiled the program.
  describe("Compiler: chapter-gated comparison opcodes", () => {
    test("`==` compiles to EQG12 at §1/§2, EQG at §3/§4", () => {
      expect(compiledEntryOpcodes("1 == 1", 1)).toContain(OpCodes.EQG12);
      expect(compiledEntryOpcodes("1 == 1", 2)).toContain(OpCodes.EQG12);
      expect(compiledEntryOpcodes("1 == 1", 3)).toContain(OpCodes.EQG);
      expect(compiledEntryOpcodes("1 == 1", 3)).not.toContain(OpCodes.EQG12);
      expect(compiledEntryOpcodes("1 == 1", 4)).toContain(OpCodes.EQG);
    });

    test("`<` compiles to LTG12 at §1/§2, LTG at §3/§4", () => {
      expect(compiledEntryOpcodes("1 < 2", 1)).toContain(OpCodes.LTG12);
      expect(compiledEntryOpcodes("1 < 2", 3)).toContain(OpCodes.LTG);
      expect(compiledEntryOpcodes("1 < 2", 3)).not.toContain(OpCodes.LTG12);
    });
  });

  const chapter12BoolExclusionTests: PVMLTestCases = {
    "== / != reject bool": [
      ["True == 1", UnsupportedOperandTypeError, null],
      ["True == True", UnsupportedOperandTypeError, null],
      ["1 != True", UnsupportedOperandTypeError, null],
    ],
    "ordering rejects bool": [
      ["True < 2", UnsupportedOperandTypeError, null],
      ["1 <= True", UnsupportedOperandTypeError, null],
    ],
    "still works for non-bool operands": [
      ["1 == 1", true, null],
      ["1 < 2", true, null],
    ],
  };

  const chapter34BoolAsIntTests: PVMLTestCases = {
    "== / != let bool participate as int": [
      ["True == 1", true, null],
      ["True == True", true, null],
      ["1 != True", false, null],
    ],
    "ordering lets bool participate as int": [
      ["True < 2", true, null],
      ["1 <= True", true, null],
      ["2 <= True", false, null],
    ],
  };

  describe("Chapter 1: == / != / ordering reject bool", () =>
    generatePVMLTestCases(chapter12BoolExclusionTests, 1));
  describe("Chapter 2: == / != / ordering reject bool", () =>
    generatePVMLTestCases(chapter12BoolExclusionTests, 2));
  describe("Chapter 3: == / != / ordering let bool participate as int", () =>
    generatePVMLTestCases(chapter34BoolAsIntTests, 3));
  describe("Chapter 4: == / != / ordering let bool participate as int", () =>
    generatePVMLTestCases(chapter34BoolAsIntTests, 4));
});
