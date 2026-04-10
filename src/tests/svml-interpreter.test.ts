import { parse } from "../parser/parser-adapter";
import { SVMLCompiler } from "../engines/svml/svml-compiler";
import { SVMLInterpreter } from "../engines/svml/svml-interpreter";
import {
  MissingRequiredPositionalError,
  UnsupportedOperandTypeError,
} from "../engines/svml/errors";

function compileAndRun(code: string): unknown {
  const ast = parse(code);
  const compiler = SVMLCompiler.fromProgram(ast);
  const program = compiler.compileProgram(ast);
  const interpreter = new SVMLInterpreter(program);
  const result = interpreter.execute();

  return SVMLInterpreter.toJSValue(result);
}

describe("SVML Interpreter Tests", () => {
  describe("Basic Arithmetic", () => {
    test("Simple function addition", () => {
      const code = `
def add(x, y):
    return x + y

add(5, 3)
`;
      const result = compileAndRun(code);
      expect(result).toBe(8);
    });

    test("Multiple arithmetic operations", () => {
      const code = `
def calculate(a, b, c):
    return (a + b) * c - a

calculate(2, 3, 4)
`;
      const result = compileAndRun(code);
      expect(result).toBe(18); // (2 + 3) * 4 - 2 = 20 - 2 = 18
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

fibonacci(10)
`;
      const result = compileAndRun(code);
      expect(result).toBe(55);
    });

    test("Factorial calculation", () => {
      const code = `
def factorial(n):
    if n <= 1:
        return 1
    else:
        return n * factorial(n - 1)

factorial(5)
`;
      const result = compileAndRun(code);
      expect(result).toBe(120);
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

ackermann(3, 4)
`;
      const result = compileAndRun(code);
      expect(result).toBe(125);
    });
  });

  describe("Function Calls", () => {
    test("Nested function calls", () => {
      const code = `
def square(x):
    return x * x

def sum_of_squares(a, b):
    return square(a) + square(b)

sum_of_squares(3, 4)
`;
      const result = compileAndRun(code);
      expect(result).toBe(25); // 9 + 16 = 25
    });

    test("Multiple nested calls", () => {
      const code = `
def double(x):
    return x * 2

def triple(x):
    return x * 3

def combine(a, b):
    return double(a) + triple(b)

combine(5, 4)
`;
      const result = compileAndRun(code);
      expect(result).toBe(22); // 10 + 12 = 22
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

is_even(6)
`;
      const result = compileAndRun(code);
      expect(result).toBe(true);
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

is_odd(7)
`;
      const result = compileAndRun(code);
      expect(result).toBe(true);
    });
  });

  describe("Lambda Expressions", () => {
    test("Simple lambda function", () => {
      const code = `
def apply(f, x):
    return f(x)

double = lambda x: x * 2
apply(double, 5)
`;
      const result = compileAndRun(code);
      expect(result).toBe(10);
    });

    test("Lambda with multiple parameters", () => {
      const code = `
multiply = lambda x, y: x * y
multiply(6, 7)
`;
      const result = compileAndRun(code);
      expect(result).toBe(42);
    });
  });

  describe("Primitive Functions", () => {
    test("Absolute value function", () => {
      const code = `abs(-5)
`;
      const result = compileAndRun(code);
      expect(result).toBe(5);
    });

    test("Max function with multiple arguments", () => {
      const code = `max(3, 7, 2, 9)
`;
      const result = compileAndRun(code);
      expect(result).toBe(9);
    });

    test("Min function with multiple arguments", () => {
      const code = `min(3, 7, 2, 9)
`;
      const result = compileAndRun(code);
      expect(result).toBe(2);
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

max_of_three(5, 9, 3)
`;
      const result = compileAndRun(code);
      expect(result).toBe(9);
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

classify_number(15)
`;
      const result = compileAndRun(code);
      expect(result).toBe("large positive");
    });
  });

  describe("SVML Generic Semantics", () => {
    test("String comparison works for generic ordered ops", () => {
      const code = `
"apple" < "banana"
`;
      const result = compileAndRun(code);
      expect(result).toBe(true);
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

add_and_check(3, 4)
`;
      const result = compileAndRun(code);
      expect(result).toBe(true);
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
total
`;
      expect(compileAndRun(code)).toBe(10);
    });

    test("for x in list literal: last value", () => {
      const code = `
last = 0
for x in [10, 20, 30]:
    last = x
last
`;
      expect(compileAndRun(code)).toBe(30);
    });

    test("list subscript", () => {
      const code = `
[1, 2, 3][1]
`;
      expect(compileAndRun(code)).toBe(2);
    });

    test("range with start, stop, step", () => {
      const code = `
last = -1
for i in range(0, 10, 2):
    last = i
last
`;
      expect(compileAndRun(code)).toBe(8);
    });

    test("break exits for loop early", () => {
      const code = `
result = 0
for i in range(10):
    if i == 3:
        break
    result = result + i
result
`;
      expect(compileAndRun(code)).toBe(3); // 0+1+2 = 3
    });

    test("nested for loops", () => {
      const code = `
total = 0
for i in range(3):
    for j in range(3):
        total = total + 1
total
`;
      expect(compileAndRun(code)).toBe(9);
    });

    test("for loop over empty range produces undefined", () => {
      const code = `
x = 42
for i in range(0):
    x = 0
x
`;
      expect(compileAndRun(code)).toBe(42);
    });

    test("range two-argument form", () => {
      const code = `
total = 0
for i in range(3, 7):
    total = total + i
total
`;
      expect(compileAndRun(code)).toBe(18); // 3+4+5+6
    });

    test("range negative step counts down", () => {
      const code = `
total = 0
for i in range(5, 0, -1):
    total = total + i
total
`;
      expect(compileAndRun(code)).toBe(15); // 5+4+3+2+1
    });

    test("range with positive step and start >= stop produces empty range", () => {
      const code = `
x = 99
for i in range(5, 0):
    x = 0
x
`;
      expect(compileAndRun(code)).toBe(99);
    });

    test("range with negative step and start <= stop produces empty range", () => {
      const code = `
x = 99
for i in range(0, 5, -1):
    x = 0
x
`;
      expect(compileAndRun(code)).toBe(99);
    });

    test("for over empty list does not execute body", () => {
      const code = `
x = 99
for item in []:
    x = 0
x
`;
      expect(compileAndRun(code)).toBe(99);
    });

    test("for loop over list literal: collect all values", () => {
      const code = `
total = 0
for x in [10, 20, 30, 40]:
    total = total + x
total
`;
      expect(compileAndRun(code)).toBe(100);
    });

    test("continue skips rest of loop body", () => {
      const code = `
total = 0
for i in range(6):
    if i == 3:
        continue
    total = total + i
total
`;
      expect(compileAndRun(code)).toBe(12); // 0+1+2+4+5 = 12
    });

    test("break in while loop", () => {
      const code = `
i = 0
while i < 10:
    if i == 4:
        break
    i = i + 1
i
`;
      expect(compileAndRun(code)).toBe(4);
    });

    test("len of list literal", () => {
      expect(compileAndRun("len([1, 2, 3])\n")).toBe(3);
    });

    test("len of empty list", () => {
      expect(compileAndRun("len([])\n")).toBe(0);
    });

    test("len of list variable", () => {
      const code = `
xs = [10, 20, 30, 40, 50]
len(xs)
`;
      expect(compileAndRun(code)).toBe(5);
    });

    test("list subscript first element", () => {
      expect(compileAndRun("[7, 8, 9][0]\n")).toBe(7);
    });

    test("list subscript last element", () => {
      expect(compileAndRun("[7, 8, 9][2]\n")).toBe(9);
    });

    test("list built in loop via subscript", () => {
      const code = `
xs = [0, 0, 0]
total = 0
for i in range(3):
    total = total + xs[i]
total
`;
      expect(compileAndRun(code)).toBe(0);
    });

    test("if without else inside loop does not corrupt stack", () => {
      const code = `
count = 0
for i in range(5):
    if i > 2:
        count = count + 1
count
`;
      expect(compileAndRun(code)).toBe(2); // i=3 and i=4
    });

    test("break on first iteration", () => {
      const code = `
result = 99
for i in range(5):
    break
result
`;
      expect(compileAndRun(code)).toBe(99);
    });

    test("nested break only exits inner loop", () => {
      const code = `
total = 0
for i in range(3):
    for j in range(10):
        if j == 2:
            break
        total = total + 1
total
`;
      expect(compileAndRun(code)).toBe(6); // 3 outer iters * 2 inner iters each
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
