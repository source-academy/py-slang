/**
 * End-to-end tests for the PVML pipeline:
 *   Python source → parse → compile → interpret
 *
 * Uses the same TestCases tuple convention as stdlib.test.ts:
 *   [code, expectedValue, expectedOutput]
 */
import {
  PVMLInterpreterError,
  UnsupportedOperandTypeError,
  ZeroDivisionError,
} from "../engines/pvml/errors";
import { PVMLCompiler } from "../engines/pvml/pvml-compiler";
import OpCodes from "../engines/pvml/opcodes";
import { parse } from "../parser/parser-adapter";
import linkedList from "../stdlib/linked-list";
import misc from "../stdlib/misc";
import math from "../stdlib/math";
import parserGroup from "../stdlib/parser";
import stream from "../stdlib/stream";
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
      // int and float are distinct types in Python, so `is` never treats them
      // as identical even at equal value. Now that PVML's `int` literals
      // compile to a genuine `bigint` (matching the CSE machine's own
      // bigint/number split — see PVMLType.BIGINT), `1` and `1.0` are
      // distinguishable at the value level: `1n !== 1.0` in JS gives the
      // correct answer for free.
      ["1 is 1.0", false, null],
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

  // Builtins that must distinguish Python `int` (bigint) from `float`
  // (number) now that PVML represents them as genuinely distinct runtime
  // types (see PVMLType.BIGINT) — mirrors the CSE machine's own
  // is_number()/is_integer()/is_float()/abs()/round()/max()/min() (misc.ts).
  const builtinBigintTests: PVMLTestCases = {
    "is_number / is_integer / is_float": [
      ["is_number(5)", true, null],
      ["is_number(5.0)", true, null],
      ["is_number(True)", false, null],
      ["is_integer(5)", true, null],
      ["is_integer(5.0)", false, null],
      ["is_float(5.0)", true, null],
      ["is_float(5)", false, null],
    ],
    "abs() preserves int/float type": [
      ["abs(-5)", 5, null],
      ["abs(-5.5)", 5.5, null],
      ["is_integer(abs(-5))", true, null],
      ["is_float(abs(-5.5))", true, null],
      ["abs(-5) is 5", true, null],
    ],
    "round() always returns an int": [
      ["round(3.5)", 4, null],
      ["round(2.5)", 2, null], // banker's rounding: rounds to even, not away from zero
      ["is_integer(round(3.5))", true, null],
      ["is_integer(round(5))", true, null],
    ],
    "max() / min() preserve the winning argument's type": [
      ["max(3, 7, 2, 9)", 9, null],
      ["is_integer(max(3, 7, 2, 9))", true, null],
      ["max(3, 7.5, 2)", 7.5, null],
      ["is_float(max(3, 7.5, 2))", true, null],
      ["min(3, 7, 2, 9)", 2, null],
      ["is_integer(min(3, 7, 2, 9))", true, null],
      ["min(3.5, 7, 2)", 2, null],
      ["is_integer(min(3.5, 7, 2))", true, null],
    ],
  };

  describe("Builtins: int/float bigint-awareness", () => generatePVMLTestCases(builtinBigintTests));

  // str()/repr() reuse the CSE machine's own formatting logic (see
  // cse-interop.ts) rather than re-deriving Python's float/string/list
  // formatting rules from scratch — these are less "does bigint math work"
  // and more "does the reuse boundary actually produce correct output".
  const strReprTests: PVMLTestCases = {
    numbers: [
      ["str(5)", "5", null],
      ["str(5.0)", "5.0", null],
      ["repr(5)", "5", null],
      ["str(-3.5)", "-3.5", null],
    ],
    "bool / None": [
      ["str(True)", "True", null],
      ["str(False)", "False", null],
      ["str(None)", "None", null],
      ["repr(None)", "None", null],
    ],
    "strings: str() vs repr() differ only on a bare string": [
      ["str('hello')", "hello", null],
      ["repr('hello')", "'hello'", null],
    ],
    "lists: elements are always quoted like repr(), even under str()": [
      ["str([1, 2, 3])", "[1, 2, 3]", null],
      ["str([1, 'a', True, None])", "[1, 'a', True, None]", null],
      ["repr([1, 'a'])", "[1, 'a']", null],
    ],
    functions: [
      ["def f():\n    pass\nstr(f)", "<function f>", null],
      ["f = lambda x: x\nstr(f)", "<function (anonymous)>", null],
      ["str(abs)", "<built-in function abs>", null],
    ],
  };

  describe("Builtins: str() / repr()", () => generatePVMLTestCases(strReprTests));

  // Complex numbers (browser-pathway only — native Pynter has zero complex
  // support and never will, see opcodes.ts's LGCC doc comment). Complex-
  // valued results are asserted via str() since PVMLTestExpectedValue has no
  // raw complex variant (see utils.ts).
  const complexTests: PVMLTestCases = {
    literals: [
      ["str(1j)", "1j", null],
      ["str(3+4j)", "(3+4j)", null],
      ["str(-4j)", "-4j", null],
    ],
    arithmetic: [
      ["str((1+2j) + (3+4j))", "(4+6j)", null],
      ["str((1+2j) - (3+4j))", "(-2-2j)", null],
      ["str((1+2j) * (3+4j))", "(-5+10j)", null],
      ["str((1+2j) / (3+4j))", "(0.44+0.08j)", null],
      ["str(1 + 2j)", "(1+2j)", null], // int + complex promotes to complex
      ["str(1.5 + 2j)", "(1.5+2j)", null], // float + complex promotes to complex
      ["str(-(3+4j))", "(-3-4j)", null], // unary minus
      ["1 / (0j)", ZeroDivisionError, null],
      ["1j // 2", UnsupportedOperandTypeError, null], // no complex floor division
      ["1j % 2", UnsupportedOperandTypeError, null], // no complex modulo
    ],
    "exponentiation (**)": [
      ["2 ** 10", 1024, null], // int ** non-negative int -> int
      ["is_integer(2 ** 10)", true, null],
      ["2 ** -1", 0.5, null], // int ** negative int -> float
      ["is_float(2 ** -1)", true, null],
      ["2 ** 0.5", Math.sqrt(2), null], // int ** float -> float
      // int ** complex -> complex: 2**i = e^(i*ln2) = cos(ln2) + i*sin(ln2)
      ["str(2 ** (0+1j))", "(0.7692389013639721+0.6389612763136348j)", null],
      ["is_complex((1+1j) ** 2)", true, null], // complex ** anything -> complex
    ],
    "equality coerces across the numeric tower": [
      ["(1+0j) == 1", true, null],
      ["(1+0j) == 1.0", true, null],
      ["1j == 1j", true, null],
      ["1j == 1", false, null],
      ["1j != 1", true, null],
    ],
    "ordering rejects complex (not orderable in Python)": [
      ["1j < 2", UnsupportedOperandTypeError, null],
      ["2 > 1j", UnsupportedOperandTypeError, null],
    ],
    "is_number / is_integer / is_float / is_complex": [
      ["is_number(3+4j)", true, null],
      ["is_integer(3+4j)", false, null],
      ["is_float(3+4j)", false, null],
      ["is_complex(3+4j)", true, null],
      ["is_complex(5)", false, null],
    ],
    "abs() is the modulus": [
      ["abs(3+4j)", 5, null],
      ["is_float(abs(3+4j))", true, null],
    ],
    "real() / imag() / complex() constructor": [
      ["real(3+4j)", 3, null],
      ["imag(3+4j)", 4, null],
      ["str(complex(3, 4))", "(3+4j)", null],
      ["real(5)", PVMLInterpreterError, null],
    ],
    "lists containing complex numbers": [["str([1, 3+4j, 2.5])", "[1, (3+4j), 2.5]", null]],
  };

  describe("Complex numbers", () => generatePVMLTestCases(complexTests));

  describe("Complex numbers: rejected for native Pynter", () => {
    test("a complex literal fails to compile in targetsPynter mode", () => {
      const ast = parse("1j\n");
      expect(() => PVMLCompiler.fromProgram(ast, 4, undefined, false, true)).not.toThrow();
      expect(() =>
        PVMLCompiler.fromProgram(ast, 4, undefined, false, true).compileProgram(ast),
      ).toThrow(/Pynter/);
    });
  });

  // Previously visitCallExpr required the callee to be a bare identifier —
  // calling a lambda directly, a call's result, or a subscripted value all
  // failed to compile. The interpreter's dispatchCall already handled a
  // runtime PVMLPrimitive/PVMLClosure value dynamically regardless of how it
  // got onto the stack (that's what already made `f = abs; f(-5)` work), so
  // this is purely a compiler-side relaxation.
  const computedCallTests: PVMLTestCases = {
    "immediately-invoked lambda": [
      ["(lambda x: x)(5)", 5, null],
      ["(lambda x, y: x + y)(3, 4)", 7, null],
    ],
    "calling a call's result (curried functions)": [
      ["def make_adder(n):\n    return lambda x: x + n\nmake_adder(3)(7)", 10, null],
      ["def f(x):\n    return lambda y: x + y\nf(1)(2)", 3, null],
      [
        "def compose(f, g):\n    return lambda x: f(g(x))\ndouble = lambda x: x * 2\ninc = lambda x: x + 1\ncompose(double, inc)(5)",
        12,
        null,
      ],
    ],
    "calling a subscripted value": [
      ["fs = [lambda x: x * 2]\nfs[0](21)", 42, null],
      ["fs = [abs, lambda x: -x]\nfs[0](-5)", 5, null],
      ["fs = [abs, lambda x: -x]\nfs[1](5)", -5, null],
    ],
    "the existing bare-name fast path still works unchanged": [
      ["def f(x):\n    return x + 1\nf(5)", 6, null],
      ["abs(-5)", 5, null],
    ],
  };

  describe("Computed / first-class function calls", () => generatePVMLTestCases(computedCallTests));

  // Rest params (function-definition side, `def f(a, *rest)`) — the rest
  // param always occupies exactly one fixed slot at compile time, bound to a
  // PVMLArray of every argument from that slot onward (see PVMLIR's
  // hasRestParam doc comment and dispatchCall in pvml-interpreter.ts).
  const restParamTests: PVMLTestCases = {
    "collects extra positional args into a list": [
      ["def f(a, *rest):\n    return len(rest)\nf(1)", 0, null],
      ["def f(a, *rest):\n    return len(rest)\nf(1, 2, 3)", 2, null],
      ["def f(a, *rest):\n    return rest[0] + rest[1]\nf(1, 2, 3)", 5, null],
    ],
    "an entirely-variadic function": [
      [
        "def total(*nums):\n    s = 0\n    for n in nums:\n        s = s + n\n    return s\ntotal(1, 2, 3, 4)",
        10,
        null,
      ],
      [
        "def total(*nums):\n    s = 0\n    for n in nums:\n        s = s + n\n    return s\ntotal()",
        0,
        null,
      ],
    ],
    "too few args for the fixed params before the rest param": [
      ["def f(a, b, *rest):\n    return a\nf(1)", Error, null],
    ],
  };

  describe("Rest parameters (def f(a, *rest))", () => generatePVMLTestCases(restParamTests));

  // Call-site argument spreading (`f(*xs)`) — xs's length isn't known until
  // runtime, so this compiles to a flattened runtime args array + CALLA/
  // CALLTA (see opcodes.ts's CALLA doc comment), independent of Phase 3's
  // computed-callee support (the two combine freely).
  const spreadCallTests: PVMLTestCases = {
    "a plain spread call": [
      ["def add3(a, b, c):\n    return a + b + c\nxs = [1, 2, 3]\nadd3(*xs)", 6, null],
    ],
    "spread mixed with fixed arguments, in either position": [
      ["def f(a, b, c):\n    return a * 100 + b * 10 + c\nxs = [2, 3]\nf(1, *xs)", 123, null],
      ["def f(a, b, c):\n    return a * 100 + b * 10 + c\nxs = [1, 2]\nf(*xs, 3)", 123, null],
      [
        "def f(a, b, c, d):\n    return a * 1000 + b * 100 + c * 10 + d\nxs = [2, 3]\nf(1, *xs, 4)",
        1234,
        null,
      ],
    ],
    "multiple spreads in one call": [
      [
        "def f(a, b, c, d):\n    return a * 1000 + b * 100 + c * 10 + d\nxs = [1, 2]\nys = [3, 4]\nf(*xs, *ys)",
        1234,
        null,
      ],
    ],
    "spreading into a primitive": [["xs = [3, 4]\nmax(*xs)", 4, null]],
    "spreading into a variadic (rest-param) function": [
      [
        "def total(*nums):\n    s = 0\n    for n in nums:\n        s = s + n\n    return s\nxs = [1, 2, 3]\ntotal(*xs)",
        6,
        null,
      ],
    ],
    "spreading into a computed callee": [
      ["fns = [lambda a, b: a + b]\nxs = [10, 20]\nfns[0](*xs)", 30, null],
    ],
    "a spread call nested as another call's argument": [
      ["def f(a, b):\n    return a + b\ndef g(*args):\n    return f(*args)\ng(3, 4)", 7, null],
    ],
    "too few args after flattening the spread": [
      ["def f(a, b):\n    return a + b\nxs = [1]\nf(*xs)", Error, null],
    ],
  };

  describe("Call-site argument spreading (f(*xs))", () => generatePVMLTestCases(spreadCallTests));

  describe("Spread/rest parameters: rejected for native Pynter", () => {
    test("a rest parameter fails to compile in targetsPynter mode", () => {
      const ast = parse("def f(a, *rest):\n    return rest\nf(1, 2)\n");
      expect(() =>
        PVMLCompiler.fromProgram(ast, 4, undefined, false, true).compileProgram(ast),
      ).toThrow(/Pynter/);
    });

    test("a spread call argument fails to compile in targetsPynter mode", () => {
      const ast = parse("def f(a, b):\n    return a + b\nxs = [1, 2]\nf(*xs)\n");
      expect(() =>
        PVMLCompiler.fromProgram(ast, 4, undefined, false, true).compileProgram(ast),
      ).toThrow(/Pynter/);
    });
  });

  // The chapter-4 metacircular `parser` stdlib group — parse()/tokenize()
  // reuse CSE's own transform()/lexer directly (see cse-interop.ts's
  // cseValueToPvmlBox), and apply_in_underlying_python() is built on
  // PVMLInterpreter's invokeValue (see its doc comment) rather than any
  // CSE-style control/stash plumbing. Parse-tree/token results are asserted
  // via str() since PVMLTestExpectedValue has no raw pair-chain variant.
  const parserGroupGroups = [misc, math, linkedList, parserGroup];
  const parserTests: PVMLTestCases = {
    tokenize: [["str(tokenize('1 + 2'))", "['1', ['+', ['2', None]]]", null]],
    parse: [
      ["str(parse('1'))", "['literal', [1, None]]", null],
      ["str(parse('x'))", "['name', ['x', None]]", null],
    ],
    apply_in_underlying_python: [
      [
        "def f(a, b):\n    return a + b\napply_in_underlying_python(f, pair(3, pair(4, None)))",
        7,
        null,
      ],
      ["apply_in_underlying_python(abs, pair(-5, None))", 5, null],
      [
        // Confirms invokeValue correctly drives a *nested* call (f calling
        // g internally) to completion, not just a single-frame primitive.
        "def g(x):\n    return x * 2\ndef f(a, b):\n    return g(a) + g(b)\napply_in_underlying_python(f, pair(3, pair(4, None)))",
        14,
        null,
      ],
    ],
  };

  describe("Chapter-4 parser group (parse/tokenize/apply_in_underlying_python)", () =>
    generatePVMLTestCases(parserTests, 4, parserGroupGroups));

  // Named numeric constants from the `math` stdlib group — referenced as
  // bare values (never called), see PRIMITIVE_CONSTANTS in builtins.ts and
  // PVMLCompiler's `isConstant` CompilerAnnotation case.
  const mathConstantsTests: PVMLTestCases = {
    "math_pi / math_e / math_tau": [
      ["math_pi", Math.PI, null],
      ["math_e", Math.E, null],
      ["math_tau", 2 * Math.PI, null],
    ],
    "math_inf / math_nan": [
      ["math_isinf(math_inf)", true, null],
      ["math_isnan(math_nan)", true, null],
    ],
  };

  describe("Named math constants (math_pi, math_e, math_inf, math_nan, math_tau)", () =>
    generatePVMLTestCases(mathConstantsTests));

  // The `math` module functions with no native-Pynter equivalent — new
  // browser-pathway-only primitive indices 104-126 (see PRIMITIVE_FUNCTIONS'
  // doc comment in builtins.ts), plus the pre-existing math_ceil/math_floor/
  // math_trunc bigint-return bug fix discovered while porting them.
  const newMathFnTests: PVMLTestCases = {
    "ceil/floor/trunc return a genuine int, not a float (bug fix)": [
      ["is_integer(math_ceil(3.2))", true, null],
      ["is_integer(math_floor(3.8))", true, null],
      ["is_integer(math_trunc(-3.8))", true, null],
      ["math_ceil(3.2)", 4, null],
      ["math_floor(3.8)", 3, null],
      ["math_trunc(-3.8)", -3, null],
    ],
    "degrees / radians": [
      ["math_degrees(math_pi)", 180, null],
      ["math_radians(180)", Math.PI, null],
    ],
    "erf / erfc": [
      ["math_erf(0)", 0, null],
      ["math_erfc(0)", 1, null],
    ],
    "comb / factorial / gcd / isqrt / lcm / perm (arbitrary-precision int)": [
      ["math_comb(5, 2)", 10, null],
      ["math_factorial(5)", 120, null],
      ["str(math_factorial(30))", "265252859812191058636308480000000", null],
      ["math_gcd(12, 18)", 6, null],
      ["math_gcd(12, 18, 24)", 6, null],
      ["math_isqrt(17)", 4, null],
      ["math_lcm(4, 6)", 12, null],
      ["math_perm(5, 2)", 20, null],
      ["math_perm(5)", 120, null],
    ],
    "fabs / fma / fmod / remainder / copysign": [
      ["math_fabs(-5)", 5, null],
      ["math_fma(2, 3, 1)", 7, null],
      ["math_fmod(7, 3)", 1, null],
      ["math_remainder(7, 3)", 1, null],
      ["math_copysign(3, -1)", -3, null],
    ],
    "isfinite / isinf / isnan": [
      ["math_isfinite(1)", true, null],
      ["math_isfinite(math_inf)", false, null],
      ["math_isinf(math_inf)", true, null],
      ["math_isnan(math_nan)", true, null],
      ["math_isnan(1)", false, null],
    ],
    "ldexp / exp2 / gamma / lgamma": [
      ["math_ldexp(1, 3)", 8, null],
      ["math_exp2(3)", 8, null],
      ["math_gamma(5)", 24, null],
      ["math_lgamma(5)", Math.log(24), null],
    ],
    "time_time (smoke test: returns a finite float)": [["math_isfinite(time_time())", true, null]],
  };

  describe("New math-module functions (Phase 6, browser-pathway-only primitives)", () =>
    generatePVMLTestCases(newMathFnTests));

  // arity() — mirrors CSE's arity() (misc.ts): a closure's fixed-parameter
  // count (the rest param's own slot index, if any), or a primitive's
  // registered minimum argument count (PRIMITIVE_MIN_ARGS in builtins.ts).
  const arityTests: PVMLTestCases = {
    builtins: [
      ["arity(abs)", 1, null],
      ["arity(pair)", 2, null],
    ],
    closures: [
      ["def f(a, b):\n    return a\narity(f)", 2, null],
      ["def f(a, *rest):\n    return a\narity(f)", 1, null],
      ["arity(lambda: None)", 0, null],
    ],
  };

  describe("arity()", () => generatePVMLTestCases(arityTests, 4, [misc, math, linkedList]));

  // stream() — mirrors CSE's stream() (stdlib/stream.ts): a lazy,
  // null-terminated sequence built from `pair(head, <0-arg continuation>)`,
  // where the continuation is represented here as the same primitive with
  // its remaining args pre-bound (PVMLPrimitive's `boundArgs`) rather than a
  // runtime-synthesized closure — see builtins.ts case 76.
  const streamTests: PVMLTestCases = {
    "stream() with no args is the empty stream": [["stream()", null, null]],
    "head / lazy tail": [
      ["head(stream(1, 2, 3))", 1, null],
      ["head(tail(stream(1, 2, 3))())", 2, null],
      ["head(tail(tail(stream(1, 2, 3))())())", 3, null],
      ["tail(stream(1))()", null, null],
    ],
    "arity of the lazy continuation is 0 (matches CSE's anonymous-stream builtin)": [
      ["arity(tail(stream(1, 2)))", 0, null],
    ],
  };

  describe("stream() — lazy, null-terminated (Phase 6)", () =>
    generatePVMLTestCases(streamTests, 4, [misc, math, linkedList, stream]));

  // `from X import Y` compiles to a no-op (matches CSE — see
  // PVMLCompiler.visitFromImportStmt), rather than throwing, since SICPy has
  // no real module system: every builtin is already globally available.
  const fromImportTests: PVMLTestCases = {
    "does not throw, and the rest of the program still runs": [
      ["from math import sin\n1 + 1", 2, null],
    ],
  };

  describe("`from X import Y` statement", () => generatePVMLTestCases(fromImportTests));
});
