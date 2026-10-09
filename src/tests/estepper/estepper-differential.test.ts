/**
 * The e-stepper against the CSE machine (py-slang#508): for every program, the output and the kind
 * of error (if any) must be the same. The e-stepper reuses the CSE machine's values, operators,
 * environments and stdlib, so any difference is a bug in its own rewriting rules.
 */
import { readFileSync } from "fs";
import { join } from "path";

import { runEStepper } from "../../conductor/estepper/getSteps";
import { parse } from "../../parser";
import { runCode } from "../../runner";

const errorKind = (message: string | undefined): string | undefined =>
  message?.match(/[A-Za-z]*Error/)?.[0];

async function viaCse(code: string, chapter: number) {
  try {
    return { output: await runCode(code, chapter), error: undefined };
  } catch (e) {
    const err = e as { output?: string; message?: string };
    return { output: err.output ?? "", error: errorKind(err.message) ?? "Error" };
  }
}

async function viaEStepper(code: string, chapter: number) {
  try {
    const run = await runEStepper(parse(code), code, chapter, 1_000_000);
    return {
      output: run.output,
      error: run.error === undefined ? undefined : (errorKind(run.error) ?? "Error"),
    };
  } catch (e) {
    return { output: "", error: errorKind((e as Error).message) ?? "Error" };
  }
}

const programs: Record<string, string> = {
  arithmetic: `print(1 + 2 * 3, 7 // 2, -7 // 2, 7 % 3, 2 ** 10, 1 / 4, 3.0 * 2)\n`,
  strings: `s = "abc"\nprint(s + "def", s[1], len(s), s == "abc", s < "abd")\n`,
  "complex numbers": `print((1 + 2j) * (3 - 1j), abs(3 + 4j))\n`,
  "boolean operators": `x = 5\nprint(x > 3 and x < 10, x < 3 or x == 5, not x == 5)\n`,
  conditional: `def sign(x):\n    return 1 if x > 0 else -1 if x < 0 else 0\nprint(sign(5), sign(-2), sign(0))\n`,
  "recursive factorial": `def fact(n):\n    return 1 if n == 0 else n * fact(n - 1)\nprint(fact(10))\n`,
  "iterative factorial": `def fact(n):\n    result = 1\n    while n > 0:\n        result = result * n\n        n = n - 1\n    return result\nprint(fact(10))\n`,
  make_withdraw: `def make_withdraw(balance):
    def withdraw(amount):
        nonlocal balance
        if balance >= amount:
            balance = balance - amount
            return balance
        else:
            return 'Insufficient funds'
    return withdraw
W1 = make_withdraw(100)
W2 = make_withdraw(100)
print(W1(50), W1(60), W2(70), W1(40))
`,
  counter: `count = 0
def increment():
    global count
    count = count + 1
    return count
increment()
increment()
print(count, increment())
`,
  make_account: `def make_account(balance):
    def withdraw(amount):
        nonlocal balance
        if balance >= amount:
            balance = balance - amount
            return balance
        else:
            return "Insufficient funds"
    def deposit(amount):
        nonlocal balance
        balance = balance + amount
        return balance
    def dispatch(m):
        if m == "withdraw":
            return withdraw
        elif m == "deposit":
            return deposit
        else:
            return error("Unknown request", m)
    return dispatch
acc = make_account(100)
print(acc("withdraw")(50), acc("deposit")(40), acc("withdraw")(200))
`,
  "for loop": `total = 0\nfor i in range(1, 11):\n    total = total + i\nprint(total)\nfor i in range(10, 0, -3):\n    print(i)\n`,
  "break and continue": `for i in range(10):
    if i == 2:
        continue
    if i == 5:
        break
    print(i)
i = 0
while True:
    i = i + 1
    if i % 2 == 0:
        continue
    if i > 7:
        break
    print(i)
`,
  "return from a loop": `def find(xs, x):
    for i in range(len(xs)):
        if xs[i] == x:
            return i
    return -1
print(find([3, 1, 4, 1, 5], 4), find([3, 1], 9))
`,
  "lists and mutation": `xs = [1, 2, 3]
ys = xs
ys[0] = 10
xs[-1] = 30
print(xs, ys, xs is ys, xs == [10, 2, 30], [10, 2, 30] is xs)
`,
  "list of lists": `m = [[1, 2], [3, 4]]\nm[1][0] = 99\nprint(m, len(m), m[1][0])\n`,
  "pairs and mutators": `p = pair(1, pair(2, None))
set_head(p, 10)
set_tail(tail(p), pair(3, None))
print(p, head(tail(tail(p))), is_pair(p))
`,
  "linked list library": `xs = llist(1, 2, 3, 4)
print(map(lambda x: x * x, xs), filter(lambda x: x % 2 == 0, xs), reduce(lambda x, y: x + y, 0, xs), length(xs))
`,
  "library calling back user code": `count = 0
def f(x):
    global count
    count = count + 1
    return x + count
print(map(f, llist(10, 20, 30)), count)
`,
  streams: `s = stream(1, 2, 3)
print(head(stream_tail(s)), is_stream(s), stream_to_llist(s))
ones = pair(1, lambda: ones)
print(stream_ref(ones, 5), eval_stream(integers_from(5), 3))
`,
  "rest parameters and spread": `def f(a, *rest):\n    return pair(a, rest)\nargs = [2, 3]\nprint(f(1), f(1, 2, 3), f(*args), f(0, *args))\n`,
  lambdas: `add = lambda x: lambda y: x + y\nprint(add(3)(4), (lambda: 42)(), (lambda *xs: xs)(1, 2))\n`,
  "closures in a loop": `fs = [None, None, None]
for i in range(3):
    def f():
        return i
    fs[i] = f
print(fs[0](), fs[2]())
`,
  "nested functions and shadowing": `x = 1
def outer():
    x = 2
    def inner():
        return x
    return inner()
print(outer(), x)
`,
  "builtins and math": `print(math_sqrt(16), max(3, 7, 5), min(2, 8), abs(-4), round(2.567, 2), is_integer(3), is_float(3.0))\n`,
  "str and repr": `print(str(1.5), repr("hi"), str([1, "a"]), [None, True])\n`,
  "printing functions": `def f(x):\n    return x\nprint(is_function(f), arity(f), arity(lambda a, b: a))\n`,
  // Errors: the kind must match.
  "zero division": `print(1)\nprint(1 // 0)\n`,
  "unbound local": `x = 1\ndef f():\n    print(x)\n    x = 2\nf()\n`,
  "free variable": `def outer():\n    def inner():\n        return y\n    r = inner()\n    y = 1\n    return r\nouter()\n`,
  "name error at runtime": `def f():\n    return undefined_name\nprint(1)\nf()\n`,
  "type error": `print(1 + "a")\n`,
  "index error": `xs = [1, 2]\nprint(xs[2])\n`,
  "bad index type": `xs = [1, 2]\nprint(xs[1.0])\n`,
  "not callable": `x = 5\nx(3)\n`,
  "wrong arity": `def f(a, b):\n    return a\nf(1)\n`,
  "too many arguments": `def f(a):\n    return a\nf(1, 2)\n`,
  "non-bool condition": `if 1:\n    print("yes")\n`,
  "non-bool and": `print(1 and True)\n`,
  "user error": `error("something went wrong", 42)\n`,
  "range step zero": `for i in range(1, 5, 0):\n    print(i)\n`,
  "range with a float": `for i in range(2.5):\n    print(i)\n`,
  "builtin reassignment": `def f():\n    global print\n    print = 1\nf()\n`,
  "head of non-pair": `print(head(None))\n`,
};

const ERROR_PROGRAMS = new Set([
  "zero division",
  "unbound local",
  "free variable",
  "name error at runtime",
  "type error",
  "index error",
  "bad index type",
  "not callable",
  "wrong arity",
  "too many arguments",
  "non-bool condition",
  "non-bool and",
  "user error",
  "range step zero",
  "range with a float",
  "builtin reassignment",
  "head of non-pair",
]);

describe.each([3, 4])("Python §%i: e-stepper agrees with the CSE machine", chapter => {
  test.each(Object.entries(programs))("%s", async (name, code) => {
    const [cse, eStepper] = await Promise.all([viaCse(code, chapter), viaEStepper(code, chapter)]);
    // The corpus itself must say what it means to: only the error programs fail.
    if (ERROR_PROGRAMS.has(name)) expect(cse.error).toBeDefined();
    else expect(cse.error).toBeUndefined();
    expect(eStepper.error).toBe(cse.error);
    expect(eStepper.output).toBe(cse.output);
  });
});

/**
 * §4 (py-slang#509): parse, tokenize, apply_in_underlying_python, and a metacircular evaluator
 * (fixtures/mce.py, in the style of SICP Python 4.1) running small programs. The e-stepper shows
 * every function body the evaluator's recursion is in, so its steps grow with the evaluated
 * program; small ones keep these tests quick.
 */
const MCE = readFileSync(join(__dirname, "fixtures/mce.py"), "utf8");
const mce = (program: string) => `${MCE}print(parse_and_evaluate(${JSON.stringify(program)}))\n`;

const section4Programs: Record<string, string> = {
  parse: `print(parse("def f(x):\\n    return x + 1 if x > 0 else -x\\nf(2)"))\n`,
  "parse of a lambda and a list": `print(parse("g = lambda y: [y, not y]"))\n`,
  tokenize: `print(tokenize("x = 1 + 2"))\n`,
  "apply_in_underlying_python, builtin": `print(apply_in_underlying_python(max, llist(3, 7, 5)))\n`,
  "apply_in_underlying_python, user function": `def f(a, b):\n    return a * b\nprint(apply_in_underlying_python(f, llist(6, 7)))\n`,
  "apply_in_underlying_python, lambda": `print(apply_in_underlying_python(lambda x: x + 1, llist(5)))\n`,
  "apply_in_underlying_python, no arguments": `print(apply_in_underlying_python(llist, None))\n`,
  "apply_in_underlying_python, not a function": `print(apply_in_underlying_python(1, llist(1)))\n`,
  "apply_in_underlying_python, a Python list": `print(apply_in_underlying_python(max, [3, 7]))\n`,
  "metacircular evaluator, literal": mce(`42\n`),
  "metacircular evaluator, operators": mce(`1 + 2 * 3\n`),
  "metacircular evaluator, lambda": mce(`(lambda x: x * 2)(21)\n`),
  "metacircular evaluator, unbound name": mce(`y\n`),
};

const SECTION_4_ERRORS = new Set([
  "apply_in_underlying_python, not a function",
  "apply_in_underlying_python, a Python list",
  "metacircular evaluator, unbound name",
]);

describe("Python §4: e-stepper agrees with the CSE machine on §4's own programs", () => {
  test.each(Object.entries(section4Programs))(
    "%s",
    async (name, code) => {
      const [cse, eStepper] = await Promise.all([viaCse(code, 4), viaEStepper(code, 4)]);
      if (SECTION_4_ERRORS.has(name)) expect(cse.error).toBeDefined();
      else expect(cse.error).toBeUndefined();
      expect(eStepper.error).toBe(cse.error);
      expect(eStepper.output).toBe(cse.output);
    },
    60_000,
  );
});
