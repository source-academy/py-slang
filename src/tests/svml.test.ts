/**
 * End-to-end tests for the SVML pipeline:
 *   Python source → parse → compile → interpret
 *
 * Uses the same TestCases tuple convention as stdlib.test.ts:
 *   [code, expectedValue, expectedOutput]
 */
import { UnsupportedOperandTypeError, ZeroDivisionError } from "../engines/svml/errors";
import { generateSVMLTestCases, SVMLTestCases } from "./utils";

describe("SVML E2E", () => {
  const functionTests: SVMLTestCases = {
    "simple calls": [
      ["def add(x, y):\n    return x + y\nadd(3, 4)", 7, null],
      ["def noop():\n    pass\nnoop()", undefined, null],
      ["def f():\n    return\nf()", undefined, null],
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

  const branchTests: SVMLTestCases = {
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

  const loopTests: SVMLTestCases = {
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

  const combinedTests: SVMLTestCases = {
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

  const errorTests: SVMLTestCases = {
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

  describe("Functions", () => generateSVMLTestCases(functionTests));
  describe("Branches", () => generateSVMLTestCases(branchTests));
  describe("Loops", () => generateSVMLTestCases(loopTests));
  describe("Combined", () => generateSVMLTestCases(combinedTests));
  describe("Errors", () => generateSVMLTestCases(errorTests));
});
