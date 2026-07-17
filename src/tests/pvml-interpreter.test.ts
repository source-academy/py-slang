import { parse } from "../parser/parser-adapter";
import { analyzeWithEnvironments } from "../resolver";
import { executePrimitive } from "../engines/pvml/builtins";
import { PVMLCompiler } from "../engines/pvml/pvml-compiler";
import { PVMLInterpreter } from "../engines/pvml/pvml-interpreter";
import type { PVMLBoxType } from "../engines/pvml/types";
import {
  MissingRequiredPositionalError,
  UnsupportedOperandTypeError,
  ZeroDivisionError,
} from "../engines/pvml/errors";
import linkedList from "../stdlib/linked-list";
import math from "../stdlib/math";
import misc from "../stdlib/misc";

/**
 * Runs `code` and returns everything print()ed, in order. A Python script
 * has no return value of its own (see pvml-compiler.ts's visitFileInputStmt
 * doc comment) — PVMLInterpreter.execute() always yields JS `undefined` now
 * — so this is the only way to observe a value at all. Test cases that want
 * to check "what does this expression evaluate to" print() it explicitly in
 * their own source, exactly like you'd actually verify that in real
 * (non-interactive) Python, and assert on the captured output text.
 */
function compileAndRun(code: string, variant: number = 4): string[] {
  const ast = parse(code);
  const compiler = PVMLCompiler.fromProgram(ast, variant);
  const program = compiler.compileProgram(ast);
  const outputs: string[] = [];
  const interpreter = new PVMLInterpreter(program, { sendOutput: msg => outputs.push(msg) });
  interpreter.execute();
  return outputs;
}

describe("PVML Interpreter Tests", () => {
  describe("Basic Arithmetic", () => {
    test("Simple function addition", () => {
      const code = `
def add(x, y):
    return x + y

print(add(5, 3))
`;
      expect(compileAndRun(code)).toEqual(["8"]);
    });

    test("Multiple arithmetic operations", () => {
      const code = `
def calculate(a, b, c):
    return (a + b) * c - a

print(calculate(2, 3, 4))
`;
      expect(compileAndRun(code)).toEqual(["18"]); // (2 + 3) * 4 - 2 = 20 - 2 = 18
    });
  });

  describe("Recursive Functions", () => {
    test("Fibonacci sequence", () => {
      const code = `
def fibonacci(n):
    if n <= 1:
        return n
    else:
        return fibonacci(n - 1) + fibonacci(n - 2)

print(fibonacci(10))
`;
      expect(compileAndRun(code)).toEqual(["55"]);
    });

    test("Factorial calculation", () => {
      const code = `
def factorial(n):
    if n <= 1:
        return 1
    else:
        return n * factorial(n - 1)

print(factorial(5))
`;
      expect(compileAndRun(code)).toEqual(["120"]);
    });

    test("Ackermann function", () => {
      const code = `
def ackermann(m, n):
    if m == 0:
        return n + 1
    else:
        if n == 0:
            return ackermann(m - 1, 1)
        else:
            return ackermann(m - 1, ackermann(m, n - 1))

print(ackermann(3, 4))
`;
      expect(compileAndRun(code)).toEqual(["125"]);
    });
  });

  describe("Function Calls", () => {
    test("Nested function calls", () => {
      const code = `
def square(x):
    return x * x

def sum_of_squares(a, b):
    return square(a) + square(b)

print(sum_of_squares(3, 4))
`;
      expect(compileAndRun(code)).toEqual(["25"]); // 9 + 16 = 25
    });

    test("Multiple nested calls", () => {
      const code = `
def double(x):
    return x * 2

def triple(x):
    return x * 3

def combine(a, b):
    return double(a) + triple(b)

print(combine(5, 4))
`;
      expect(compileAndRun(code)).toEqual(["22"]); // 10 + 12 = 22
    });
  });

  describe("Mutual Recursion", () => {
    test("Even/odd mutual recursion", () => {
      const code = `
def is_even(n):
    if n == 0:
        return True
    else:
        return is_odd(n - 1)

def is_odd(n):
    if n == 0:
        return False
    else:
        return is_even(n - 1)

print(is_even(6))
`;
      expect(compileAndRun(code)).toEqual(["True"]);
    });

    test("Odd number check", () => {
      const code = `
def is_even(n):
    if n == 0:
        return True
    else:
        return is_odd(n - 1)

def is_odd(n):
    if n == 0:
        return False
    else:
        return is_even(n - 1)

print(is_odd(7))
`;
      expect(compileAndRun(code)).toEqual(["True"]);
    });
  });

  describe("Lambda Expressions", () => {
    test("Simple lambda function", () => {
      const code = `
def apply(f, x):
    return f(x)

double = lambda x: x * 2
print(apply(double, 5))
`;
      expect(compileAndRun(code)).toEqual(["10"]);
    });

    test("Lambda with multiple parameters", () => {
      const code = `
multiply = lambda x, y: x * y
print(multiply(6, 7))
`;
      expect(compileAndRun(code)).toEqual(["42"]);
    });
  });

  describe("Primitive Functions", () => {
    test("Absolute value function", () => {
      const code = `print(abs(-5))
`;
      expect(compileAndRun(code)).toEqual(["5"]);
    });

    test("Max function with multiple arguments", () => {
      const code = `print(max(3, 7, 2, 9))
`;
      expect(compileAndRun(code)).toEqual(["9"]);
    });

    test("Min function with multiple arguments", () => {
      const code = `print(min(3, 7, 2, 9))
`;
      expect(compileAndRun(code)).toEqual(["2"]);
    });
  });

  describe("Conditional Expressions", () => {
    test("Nested if-else conditions", () => {
      const code = `
def max_of_three(a, b, c):
    if a > b:
        if a > c:
            return a
        else:
            return c
    else:
        if b > c:
            return b
        else:
            return c

print(max_of_three(5, 9, 3))
`;
      expect(compileAndRun(code)).toEqual(["9"]);
    });

    test("Complex conditional logic", () => {
      const code = `
def classify_number(n):
    if n > 0:
        if n > 10:
            return "large positive"
        else:
            return "small positive"
    else:
        if n < -10:
            return "large negative"
        else:
            return "small negative or zero"

print(classify_number(15))
`;
      expect(compileAndRun(code)).toEqual(["large positive"]);
    });
  });

  describe("PVML Generic Semantics", () => {
    test("String comparison works for generic ordered ops", () => {
      const code = `
print("apple" < "banana")
`;
      expect(compileAndRun(code)).toEqual(["True"]);
    });

    test("not on non-boolean throws UnsupportedOperandTypeError", () => {
      const code = `
not 1
`;
      expect(() => compileAndRun(code)).toThrow(UnsupportedOperandTypeError);
    });

    test("branch condition must be boolean", () => {
      const code = `
if 1:
    10
else:
    20
`;
      expect(() => compileAndRun(code)).toThrow(UnsupportedOperandTypeError);
    });
  });

  describe("Typed Opcode Paths", () => {
    test("Typed arithmetic and equality behavior stays correct", () => {
      const code = `
def add_and_check(x, y):
    return (x + y) == 7

print(add_and_check(3, 4))
`;
      expect(compileAndRun(code)).toEqual(["True"]);
    });
  });

  describe("Error Handling", () => {
    test("String and number addition throws UnsupportedOperandTypeError", () => {
      const code = `
1+""
`;
      expect(() => compileAndRun(code)).toThrow(UnsupportedOperandTypeError);
    });
  });

  describe("For Loops and Iterators", () => {
    test("for i in range(5): sum all", () => {
      const code = `
total = 0
for i in range(5):
    total = total + i
print(total)
`;
      expect(compileAndRun(code)).toEqual(["10"]);
    });

    test("for x in list literal: last value", () => {
      const code = `
last = 0
for x in [10, 20, 30]:
    last = x
print(last)
`;
      expect(compileAndRun(code)).toEqual(["30"]);
    });

    test("list subscript", () => {
      const code = `
print([1, 2, 3][1])
`;
      expect(compileAndRun(code)).toEqual(["2"]);
    });

    test("range with start, stop, step", () => {
      const code = `
last = -1
for i in range(0, 10, 2):
    last = i
print(last)
`;
      expect(compileAndRun(code)).toEqual(["8"]);
    });

    test("break exits for loop early", () => {
      const code = `
result = 0
for i in range(10):
    if i == 3:
        break
    result = result + i
print(result)
`;
      expect(compileAndRun(code)).toEqual(["3"]); // 0+1+2 = 3
    });

    test("nested for loops", () => {
      const code = `
total = 0
for i in range(3):
    for j in range(3):
        total = total + 1
print(total)
`;
      expect(compileAndRun(code)).toEqual(["9"]);
    });

    test("for loop over empty range leaves the variable unchanged", () => {
      const code = `
x = 42
for i in range(0):
    x = 0
print(x)
`;
      expect(compileAndRun(code)).toEqual(["42"]);
    });

    test("range two-argument form", () => {
      const code = `
total = 0
for i in range(3, 7):
    total = total + i
print(total)
`;
      expect(compileAndRun(code)).toEqual(["18"]); // 3+4+5+6
    });

    test("range negative step counts down", () => {
      const code = `
total = 0
for i in range(5, 0, -1):
    total = total + i
print(total)
`;
      expect(compileAndRun(code)).toEqual(["15"]); // 5+4+3+2+1
    });

    test("range with positive step and start >= stop produces empty range", () => {
      const code = `
x = 99
for i in range(5, 0):
    x = 0
print(x)
`;
      expect(compileAndRun(code)).toEqual(["99"]);
    });

    test("range with negative step and start <= stop produces empty range", () => {
      const code = `
x = 99
for i in range(0, 5, -1):
    x = 0
print(x)
`;
      expect(compileAndRun(code)).toEqual(["99"]);
    });

    test("for over empty list does not execute body", () => {
      const code = `
x = 99
for item in []:
    x = 0
print(x)
`;
      expect(compileAndRun(code)).toEqual(["99"]);
    });

    test("for loop over list literal: collect all values", () => {
      const code = `
total = 0
for x in [10, 20, 30, 40]:
    total = total + x
print(total)
`;
      expect(compileAndRun(code)).toEqual(["100"]);
    });

    test("continue skips rest of loop body", () => {
      const code = `
total = 0
for i in range(6):
    if i == 3:
        continue
    total = total + i
print(total)
`;
      expect(compileAndRun(code)).toEqual(["12"]); // 0+1+2+4+5 = 12
    });

    test("break in while loop", () => {
      const code = `
i = 0
while i < 10:
    if i == 4:
        break
    i = i + 1
print(i)
`;
      expect(compileAndRun(code)).toEqual(["4"]);
    });

    test("len of list literal", () => {
      expect(compileAndRun("print(len([1, 2, 3]))\n")).toEqual(["3"]);
    });

    test("len of empty list", () => {
      expect(compileAndRun("print(len([]))\n")).toEqual(["0"]);
    });

    test("len of list variable", () => {
      const code = `
xs = [10, 20, 30, 40, 50]
print(len(xs))
`;
      expect(compileAndRun(code)).toEqual(["5"]);
    });

    test("list subscript first element", () => {
      expect(compileAndRun("print([7, 8, 9][0])\n")).toEqual(["7"]);
    });

    test("list subscript last element", () => {
      expect(compileAndRun("print([7, 8, 9][2])\n")).toEqual(["9"]);
    });

    test("list built in loop via subscript", () => {
      const code = `
xs = [0, 0, 0]
total = 0
for i in range(3):
    total = total + xs[i]
print(total)
`;
      expect(compileAndRun(code)).toEqual(["0"]);
    });

    test("if without else inside loop does not corrupt stack", () => {
      const code = `
count = 0
for i in range(5):
    if i > 2:
        count = count + 1
print(count)
`;
      expect(compileAndRun(code)).toEqual(["2"]); // i=3 and i=4
    });

    test("break on first iteration", () => {
      const code = `
result = 99
for i in range(5):
    break
print(result)
`;
      expect(compileAndRun(code)).toEqual(["99"]);
    });

    test("nested break only exits inner loop", () => {
      const code = `
total = 0
for i in range(3):
    for j in range(10):
        if j == 2:
            break
        total = total + 1
print(total)
`;
      expect(compileAndRun(code)).toEqual(["6"]); // 3 outer iters * 2 inner iters each
    });
  });

  describe("Builtin argument validation", () => {
    test("range() with no arguments throws", () => {
      expect(() => compileAndRun("range()\n")).toThrow(MissingRequiredPositionalError);
    });

    test("range() with 4 arguments throws", () => {
      expect(() => compileAndRun("range(1, 2, 3, 4)\n")).toThrow(MissingRequiredPositionalError);
    });

    test("range() with step=0 throws ValueError", () => {
      expect(() => compileAndRun("range(0, 10, 0)\n")).toThrow(/ValueError.*zero/);
    });

    test("len() with no arguments throws", () => {
      expect(() => compileAndRun("len()\n")).toThrow(MissingRequiredPositionalError);
    });

    test("len() with non-array argument throws with type information", () => {
      expect(() => compileAndRun("len(42)\n")).toThrow(/TypeError/);
    });
  });
});

describe("PVML Additional Coverage", () => {
  describe("Arithmetic operators", () => {
    test("floor division positive", () => {
      expect(compileAndRun("print(7 // 2)\n")).toEqual(["3"]);
    });

    test("floor division negative rounds toward -infinity", () => {
      expect(compileAndRun("print(-7 // 2)\n")).toEqual(["-4"]);
    });

    test("modulo positive", () => {
      expect(compileAndRun("print(10 % 3)\n")).toEqual(["1"]);
    });

    test("modulo Python semantics: negative dividend", () => {
      expect(compileAndRun("print(-7 % 3)\n")).toEqual(["2"]);
    });

    test("modulo Python semantics: negative divisor", () => {
      expect(compileAndRun("print(7 % -3)\n")).toEqual(["-2"]);
    });

    test("true division returns float", () => {
      expect(compileAndRun("print(5 / 2)\n")).toEqual(["2.5"]);
    });

    test("float literal", () => {
      expect(compileAndRun("print(3.14)\n")).toEqual(["3.14"]);
    });

    test("string concatenation", () => {
      expect(compileAndRun('print("hello" + " world")\n')).toEqual(["hello world"]);
    });

    test("unary plus is identity", () => {
      expect(compileAndRun("print(+42)\n")).toEqual(["42"]);
    });
  });

  describe("Division / modulo by zero", () => {
    test("integer division by zero throws ZeroDivisionError", () => {
      expect(() => compileAndRun("1 / 0\n")).toThrow(ZeroDivisionError);
    });

    test("floor division by zero throws ZeroDivisionError", () => {
      expect(() => compileAndRun("1 // 0\n")).toThrow(ZeroDivisionError);
    });

    test("modulo by zero throws ZeroDivisionError", () => {
      expect(() => compileAndRun("1 % 0\n")).toThrow(ZeroDivisionError);
    });
  });

  describe("Type errors", () => {
    test("subtraction of incompatible types throws", () => {
      expect(() => compileAndRun('"a" - 1\n')).toThrow(UnsupportedOperandTypeError);
    });

    test("multiplication of incompatible types throws", () => {
      expect(() => compileAndRun('"a" * "b"\n')).toThrow(UnsupportedOperandTypeError);
    });

    test("unary minus on non-number throws", () => {
      expect(() => compileAndRun('-"x"\n')).toThrow(UnsupportedOperandTypeError);
    });

    test("ordered comparison of mixed types throws", () => {
      expect(() => compileAndRun('"x" < 3\n')).toThrow(UnsupportedOperandTypeError);
    });

    test("calling a non-callable value raises a proper TypeError, not a raw JS crash", () => {
      expect(() => compileAndRun("x = 5\nx()\n")).toThrow(/TypeError.*not callable/);
    });
  });

  describe("Literals and expressions", () => {
    test("None literal prints as None", () => {
      expect(compileAndRun("print(None)\n")).toEqual(["None"]);
    });

    test("ternary expression true branch", () => {
      expect(compileAndRun("print(1 if True else 2)\n")).toEqual(["1"]);
    });

    test("ternary expression false branch", () => {
      expect(compileAndRun("print(1 if False else 2)\n")).toEqual(["2"]);
    });

    test("boolean and short-circuits on false left", () => {
      expect(compileAndRun("print(False and True)\n")).toEqual(["False"]);
    });

    test("boolean and evaluates right when left is true", () => {
      expect(compileAndRun("print(True and True)\n")).toEqual(["True"]);
    });

    test("boolean or short-circuits on true left", () => {
      expect(compileAndRun("print(True or False)\n")).toEqual(["True"]);
    });

    test("boolean or evaluates right when left is false", () => {
      expect(compileAndRun("print(False or False)\n")).toEqual(["False"]);
    });
  });

  describe("Statements", () => {
    test("pass statement produces no output", () => {
      expect(compileAndRun("pass\n")).toEqual([]);
    });

    test("bare return yields None", () => {
      const code = `
def f():
    return
print(f())
`;
      expect(compileAndRun(code)).toEqual(["None"]);
    });

    test("while with continue skips iteration", () => {
      const code = `
total = 0
i = 0
while i < 6:
    i = i + 1
    if i == 3:
        continue
    total = total + i
print(total)
`;
      expect(compileAndRun(code)).toEqual(["18"]);
    });
  });

  describe("Closures and environments", () => {
    test("closure captures outer variable", () => {
      const code = `
def make_adder(n):
    def add(x):
        return x + n
    return add

add5 = make_adder(5)
print(add5(3))
`;
      expect(compileAndRun(code)).toEqual(["8"]);
    });
  });

  describe("Python str() of function/array values", () => {
    test("a named closure prints as <function name>", () => {
      const code = `
def f(x):
    return x
print(f)
`;
      expect(compileAndRun(code)).toEqual(["<function f>"]);
    });

    test("array prints as [1, 2, 3]", () => {
      expect(compileAndRun("print([1, 2, 3])\n")).toEqual(["[1, 2, 3]"]);
    });
  });

  describe("Print / sendOutput", () => {
    test("print() routes through sendOutput callback", () => {
      expect(compileAndRun('print("hello")\n')).toEqual(["hello"]);
    });

    test("multiple print calls each trigger callback", () => {
      expect(compileAndRun('print("a")\nprint("b")\n')).toEqual(["a", "b"]);
    });

    test("no output when print not called", () => {
      expect(compileAndRun("1 + 1\n")).toEqual([]);
    });
  });

  describe("print_llist", () => {
    // PVMLCompiler.fromProgram's no-args default only registers [misc, math] (VARIANT_GROUPS[1]),
    // so pair/llist/print_llist (linked-list group) need explicit environments with that group in
    // scope -- compileAndRun above can't resolve them.
    function compileAndRunWithLinkedList(code: string): string[] {
      const groups = [misc, math, linkedList];
      const ast = parse(code);
      const { errors, environments } = analyzeWithEnvironments(ast, code, 2, groups);
      if (errors.length > 0) throw new Error(errors.map(e => e.message).join("; "));
      const outputs: string[] = [];
      const compiler = PVMLCompiler.fromProgram(ast, 2, environments);
      const program = compiler.compileProgram(ast);
      const interpreter = new PVMLInterpreter(program, { sendOutput: msg => outputs.push(msg) });
      interpreter.execute();
      return outputs;
    }

    test("renders a proper linked list as llist(...)", () => {
      expect(compileAndRunWithLinkedList("print_llist(llist(1, 2, 3))\n")).toEqual([
        "llist(1, 2, 3)",
      ]);
    });

    test("renders None as llist()", () => {
      expect(compileAndRunWithLinkedList("print_llist(None)\n")).toEqual(["llist()"]);
    });

    test("renders a non-list pair as [head, tail]", () => {
      expect(compileAndRunWithLinkedList("print_llist(pair(1, 2))\n")).toEqual(["[1, 2]"]);
    });

    test("a proper-list element nested in an improper pair still renders as llist(...)", () => {
      expect(
        compileAndRunWithLinkedList("print_llist(pair(llist(1, 2, 3), llist(4, 5, 6)))\n"),
      ).toEqual(["llist(llist(1, 2, 3), 4, 5, 6)"]);
    });

    test("string elements render quoted", () => {
      expect(compileAndRunWithLinkedList("print_llist(llist('a', 'b'))\n")).toEqual([
        "llist('a', 'b')",
      ]);
    });

    test("requires exactly 1 argument", () => {
      expect(() => compileAndRunWithLinkedList("print_llist()\n")).toThrow(
        MissingRequiredPositionalError,
      );
    });

    // Regression test for source-academy/js-slang#1124 (display_list rendered the wrong notation
    // for a value reachable via two different paths in the same structure). print_llist's
    // algorithm is plain recursion with no identity-keyed memoization, so it can't reproduce that
    // bug: the same pair object is re-derived fresh from its own structure every time it's
    // visited, regardless of which parent reached it.
    test("does not misrender a shared sub-list (js-slang#1124)", () => {
      expect(
        compileAndRunWithLinkedList(
          "x1 = llist(2, 3)\nx2 = llist(x1, pair(1, x1))\nprint_llist(x2)\n",
        ),
      ).toEqual(["llist(llist(2, 3), llist(1, 2, 3))"]);
    });

    // Regression test for the O(N^2)/stack-overflow bug caught in review on #250: printLlistText
    // used to re-run a *recursive* isProperLlist on every tail suffix while unrolling an improper
    // structure's bracket notation, making the whole walk O(N^2) -- and that recursive isProperLlist
    // could itself overflow the stack on a long chain even on its own. Built directly via
    // executePrimitive (bypassing PVML compilation, which has no way to express a 50,000-element
    // program compactly) so this isolates printLlistText's own complexity. improperN is well past
    // where the old O(N^2) behavior would have made this test time out, but -- unlike the
    // proper-list case below -- still bounded by the bracket notation's own inherent O(N) nesting
    // depth (acknowledged, accepted limitation; matches the CSE machine's equivalent recursion-depth
    // ceiling).
    test("stays fast and stack-safe on large structures", () => {
      const pairArr = (h: PVMLBoxType, t: PVMLBoxType): PVMLBoxType => ({
        type: "array",
        elements: [h, t],
      });

      const improperN = 3000;
      let improperChain: PVMLBoxType = 999;
      for (let i = improperN; i >= 1; i--) improperChain = pairArr(i, improperChain);
      const improperOutputs: string[] = [];
      executePrimitive(
        127,
        [improperChain],
        msg => improperOutputs.push(msg),
        () => {
          throw new Error("print_llist should never call invokeValue");
        },
      );
      expect(improperOutputs[0].startsWith("[1, [2, [3,")).toBe(true);
      expect(improperOutputs[0].endsWith("999" + "]".repeat(improperN))).toBe(true);

      const properN = 50000;
      let properChain: PVMLBoxType = null;
      for (let i = properN; i >= 1; i--) properChain = pairArr(i, properChain);
      const properOutputs: string[] = [];
      executePrimitive(
        127,
        [properChain],
        msg => properOutputs.push(msg),
        () => {
          throw new Error("print_llist should never call invokeValue");
        },
      );
      expect(properOutputs[0].startsWith("llist(1, 2, 3,")).toBe(true);
      expect(properOutputs[0].endsWith(`${properN - 1}, ${properN})`)).toBe(true);
    });
  });

  describe("Execution limits", () => {
    test("exceeding maxInstructions throws", () => {
      const code = `
def loop():
    return loop()
loop()
`;
      const ast = parse(code);
      const program = PVMLCompiler.fromProgram(ast, 4).compileProgram(ast);
      const interpreter = new PVMLInterpreter(program, { maxInstructions: 50 });
      expect(() => interpreter.execute()).toThrow(/instruction limit/i);
    });

    test("exceeding maxCallDepth throws", () => {
      // Not tail-recursive: `1 +` is still pending after the recursive call
      // returns, so this genuinely grows the call stack (unlike `return
      // loop()` above, which the compiler now compiles as a tail call —
      // see visitReturnStmt/compileTail — and so never grows call depth).
      const code = `
def loop():
    return 1 + loop()
loop()
`;
      const ast = parse(code);
      const program = PVMLCompiler.fromProgram(ast, 4).compileProgram(ast);
      const interpreter = new PVMLInterpreter(program, { maxCallDepth: 5 });
      expect(() => interpreter.execute()).toThrow(/call depth/i);
    });
  });

  describe("fromProgram with pre-computed environments", () => {
    test("accepts pre-computed environments and skips resolver", () => {
      const code = "def f(x):\n    return x + 1\nprint(f(10))\n";
      const ast = parse(code);
      const { environments } = analyzeWithEnvironments(ast, code, 4, [misc, math]);
      const compiler = PVMLCompiler.fromProgram(ast, 4, environments);
      const outputs: string[] = [];
      const interpreter = new PVMLInterpreter(compiler.compileProgram(ast), {
        sendOutput: msg => outputs.push(msg),
      });
      interpreter.execute();
      expect(outputs).toEqual(["11"]);
    });
  });

  describe("Builtins coverage", () => {
    test("round() rounds half-up", () => {
      expect(compileAndRun("print(round(3.5))\n")).toEqual(["4"]);
    });

    test("min() with a single argument throws MissingRequiredPositionalError", () => {
      expect(() => compileAndRun("min(7)\n")).toThrow(MissingRequiredPositionalError);
    });

    test("max() with a single argument throws MissingRequiredPositionalError", () => {
      expect(() => compileAndRun("max(7)\n")).toThrow(MissingRequiredPositionalError);
    });

    test("min() with zero arguments throws MissingRequiredPositionalError", () => {
      expect(() => compileAndRun("min()\n")).toThrow(MissingRequiredPositionalError);
    });

    test("max() with zero arguments throws MissingRequiredPositionalError", () => {
      expect(() => compileAndRun("max()\n")).toThrow(MissingRequiredPositionalError);
    });

    // Verified against real CPython (math.remainder's IEEE 754 special cases).
    test("max()/min() skip a NaN argument that isn't already the running winner", () => {
      expect(compileAndRun("print(max(1, math_nan, 3))\n")).toEqual(["3"]);
      expect(compileAndRun("print(min(3, math_nan, 1))\n")).toEqual(["1"]);
    });

    test("max()/min() return NaN if the first argument is NaN (matches CSE's plain >/< comparison)", () => {
      expect(compileAndRun("print(max(math_nan, 1, 3))\n")).toEqual(["nan"]);
      expect(compileAndRun("print(min(math_nan, 1, 3))\n")).toEqual(["nan"]);
    });

    test("math_remainder(finite, infinity) returns the finite value unchanged", () => {
      // math.remainder always returns a float in real Python, even for two int inputs.
      expect(compileAndRun("print(math_remainder(5, math_inf))\n")).toEqual(["5.0"]);
    });

    test("math_remainder(infinity, finite) raises a domain error", () => {
      expect(() => compileAndRun("math_remainder(math_inf, 5)\n")).toThrow(/ValueError.*domain/);
    });

    test("math_remainder(x, 0) raises a domain error, not a ZeroDivisionError", () => {
      expect(() => compileAndRun("math_remainder(5, 0)\n")).toThrow(/ValueError.*domain/);
    });

    test("math_remainder propagates NaN", () => {
      expect(compileAndRun("print(math_remainder(math_nan, 5))\n")).toEqual(["nan"]);
    });

    test("math_ldexp(0, huge exponent) is 0, not NaN", () => {
      // math.ldexp always returns a float in real Python.
      expect(compileAndRun("print(math_ldexp(0, 10**30))\n")).toEqual(["0.0"]);
    });

    test("math_ldexp overflow raises OverflowError", () => {
      expect(() => compileAndRun("math_ldexp(1.0, 10**30)\n")).toThrow(/OverflowError/);
    });

    test("time_time() returns seconds, not milliseconds", () => {
      const before = Date.now() / 1000;
      const outputs = compileAndRun("print(time_time())\n");
      const after = Date.now() / 1000;
      const result = Number(outputs[0]);
      expect(result).toBeGreaterThanOrEqual(before - 1);
      expect(result).toBeLessThanOrEqual(after + 1);
    });
  });
});
