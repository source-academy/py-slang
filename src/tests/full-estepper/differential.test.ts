/**
 * Differential tests of the full e-stepper: every program here is run by CPython and by the engine,
 * and what it prints and the name of the exception that stops it (if any) must be the same. (The
 * messages of the exceptions differ between versions of CPython, so they are not compared.)
 */

import { evaluate } from "../../conductor/full-estepper/run";
import { cpython, cpythonAvailable } from "./cpython";

const describeIfCPython = cpythonAvailable ? describe : describe.skip;

function same(code: string): void {
  const expected = cpython(code);
  const actual = evaluate(code, 2_000_000);
  expect(actual.truncated).toBe(false);
  expect(actual.error?.kind ?? null).toBe(expected.error);
  expect(actual.output).toBe(expected.output);
}

/** `print(repr(<expression>))` for each expression, or the error that it raises. */
const expressions = (list: string[]): [string][] => list.map(e => [e]);

describeIfCPython("the values of expressions", () => {
  test.each(
    expressions([
      // int arithmetic
      "1 + 2",
      "7 - 10",
      "6 * 7",
      "7 // 2",
      "-7 // 2",
      "7 // -2",
      "-7 // -2",
      "7 % 3",
      "-7 % 3",
      "7 % -3",
      "-7 % -3",
      "2 ** 10",
      "2 ** 0",
      "0 ** 0",
      "(-2) ** 3",
      "-2 ** 2",
      "3 ** 3 ** 2",
      "10 ** 20",
      "10 ** 20 + 1",
      "123456789 * 987654321 * 192837465",
      "-(2 ** 70) // 3",
      "(2 ** 70) % 1000",
      // true division and floats
      "7 / 2",
      "6 / 3",
      "-7 / 2",
      "1 / 3",
      "2 ** -1",
      "2 ** -2",
      "4 ** 0.5",
      "0.1 + 0.2",
      "0.1 * 3",
      "1.5 + 1",
      "1 + 1.5",
      "5 // 2.0",
      "-5 // 2.0",
      "5.5 // 2",
      "5.5 % 2",
      "-5.5 % 2",
      "5 % -2.5",
      "2.5 ** 2",
      "1e16",
      "1e15",
      "1e22",
      "1.5e300 * 1e10",
      "1e-4",
      "1e-5",
      "0.00012345",
      "123456789.123456789",
      "1.0",
      "100.0",
      "3.14159",
      "float(10 ** 15)",
      "float(10 ** 16)",
      "float('inf')",
      "-float('inf')",
      "float('inf') - float('inf')",
      "float('nan') == float('nan')",
      "-0.0",
      "0.0 == -0.0",
      // booleans are ints
      "True + True",
      "True * 5",
      "False - 1",
      "True / 2",
      "-True",
      "~True",
      "True == 1",
      "1 == 1.0",
      "True is True",
      // unary
      "-5",
      "+5",
      "~5",
      "~-1",
      "-(-3)",
      "not 0",
      "not 1",
      "not []",
      "not [0]",
      "not ''",
      "not 'a'",
      "not None",
      // comparison
      "1 < 2",
      "2 < 1",
      "2 <= 2",
      "3 > 2.5",
      "1 != 1.0",
      "2 ** 100 > 1e30",
      "2 ** 100 == float(2 ** 100)",
      "'a' < 'b'",
      "'abc' < 'abd'",
      "'b' < 'abc'",
      "'a' == 'a'",
      "[1, 2] < [1, 3]",
      "[1, 2] < [1, 2, 0]",
      "[1, 2] == [1, 2]",
      "[1, [2]] == [1, [2]]",
      "[] == []",
      "[] < [1]",
      "None == None",
      "None is None",
      "None is not None",
      "1 is 1",
      "'a' is 'a'",
      "[] is []",
      "1 in [1, 2]",
      "3 in [1, 2]",
      "[1] in [[1], 2]",
      "'x' in 'xyz'",
      "'yz' in 'xyz'",
      "'q' not in 'xyz'",
      "2 in range(5)",
      "5 in range(5)",
      "4 in range(0, 10, 2)",
      "5 in range(0, 10, 2)",
      "2.0 in range(5)",
      // and / or return an operand
      "1 and 2",
      "0 and 2",
      "[] and 2",
      "1 or 2",
      "0 or 2",
      "'' or 'x'",
      "None or 0",
      "0 or 5 and 6",
      "0 and 5 or 6",
      "[] or [1]",
      "1 and 2 and 3",
      "1 and 0 and 3",
      // conditional expression
      "1 if True else 2",
      "1 if 0 else 2",
      "1 if [] else 2",
      "1 if 'x' else 2",
      "1 if None else 2 if 0 else 3",
      // strings
      "'a' + 'b'",
      "'ab' * 3",
      "3 * 'ab'",
      "'ab' * 0",
      "'ab' * -1",
      "'hello'[1]",
      "'hello'[-1]",
      "len('hello')",
      "len('')",
      "str(12)",
      "str(1.0)",
      "str('x')",
      "str(None)",
      "str(True)",
      "str([1, 'a', None])",
      "repr('x')",
      'repr("it\'s")',
      "repr('say \"hi\"')",
      "repr('both \\' and \"')",
      "repr('tab\\there')",
      "repr('line\\nbreak')",
      "repr('back\\\\slash')",
      "repr('\\x01')",
      "repr('é')",
      "'' + ''",
      // lists
      "[1, 2] + [3]",
      "[0] * 3",
      "3 * [1, 2]",
      "[1] * 0",
      "[1, [2, 3], 'a', None, True, 1.5]",
      "len([1, 2, 3])",
      "[1, 2, 3][0]",
      "[1, 2, 3][-1]",
      "[1, 2, 3][-3]",
      "[[1, 2], [3]][0][1]",
      "list(range(3))",
      "list(range(2, 8, 2))",
      "list(range(10, 0, -3))",
      "list(range(0))",
      "list('ab')",
      "list([1, 2])",
      "list()",
      // range
      "range(5)",
      "range(1, 5)",
      "range(1, 10, 3)",
      "len(range(0, 10, 3))",
      "len(range(10, 0, -1))",
      "range(5)[2]",
      "range(5)[-1]",
      "range(0, 10, 3)[3]",
      // built-in functions
      "abs(-3)",
      "abs(3)",
      "abs(-3.5)",
      "abs(True)",
      "min(3, 1, 2)",
      "max(3, 1, 2)",
      "min([4, 2, 8])",
      "max([4, 2, 8])",
      "min('b', 'a')",
      "max('abc')",
      "min(range(3, 8))",
      "max(1, 1.0)",
      "min(1.0, 1)",
      "int('42')",
      "int('-7')",
      "int('  12  ')",
      "int('1_000')",
      "int(3.9)",
      "int(-3.9)",
      "int(True)",
      "int()",
      "float('1.5')",
      "float('  2.5e3 ')",
      "float('.5')",
      "float('5.')",
      "float('-1e-3')",
      "float(2)",
      "float(True)",
      "float()",
      "bool()",
      "bool(0)",
      "bool(0.0)",
      "bool('')",
      "bool('0')",
      "bool([])",
      "bool([0])",
      "bool(None)",
      "bool(range(0))",
      "bool(len)",
    ]),
  )("%s", expression => same(`print(repr(${expression}))\n`));
});

describeIfCPython("the errors of expressions", () => {
  test.each(
    expressions([
      "1 / 0",
      "1 // 0",
      "1 % 0",
      "1.0 / 0",
      "1.0 // 0",
      "1.0 % 0",
      "1 / 0.0",
      "0 ** -1",
      "0.0 ** -1",
      "1 + 'a'",
      "'a' + 1",
      "'a' - 'b'",
      "'a' * 'b'",
      "[1] + 2",
      "[1] - [1]",
      "None + 1",
      "-'a'",
      "+[]",
      "~1.5",
      "~'a'",
      "len(5)",
      "len(None)",
      "len()",
      "len(1, 2)",
      "[1, 2][5]",
      "[1, 2][-3]",
      "[][0]",
      "'abc'[10]",
      "'abc'[-4]",
      "[1]['a']",
      "[1][1.0]",
      "'abc'['a']",
      "range(3)[5]",
      "5[0]",
      "None[0]",
      "None()",
      "3()",
      "'a'()",
      "int('x')",
      "int('1.5')",
      "int('')",
      "int(None)",
      "int([])",
      "int(float('inf'))",
      "int(float('nan'))",
      "float('x')",
      "float('')",
      "float(None)",
      "float([])",
      "abs('a')",
      "abs()",
      "abs(1, 2)",
      "min()",
      "min([])",
      "max([])",
      "min(5)",
      "min(1, 'a')",
      "range()",
      "range(1.5)",
      "range('a')",
      "range(1, 2, 3, 4)",
      "range(0, 10, 0)",
      "1 < 'a'",
      "'a' < 1",
      "[1, 2] < 'a'",
      "None < 1",
      "[1] < [None]",
      "5 in 5",
      "None in None",
      "1 in 'abc'",
      "undefined_name",
      "undefined_name + 1",
      "list(5)",
      "list(1, 2)",
      "bool(1, 2)",
      "str(1, 2, 3, 4)",
      "True + 'a'",
      "10 ** 5000",
      "len(repr(10 ** 4299))",
    ]),
  )("%s", expression => same(`print(repr(${expression}))\n`));

  test("an error stops the program after what it printed", () => {
    same("print(1)\nprint(2)\nprint(1 / 0)\nprint(3)\n");
  });
});

describeIfCPython("statements", () => {
  test.each<[string, string]>([
    ["assignment and print", "x = 1\ny = x + 1\nprint(x, y)\n"],
    ["print of every kind of value", "print(1, 'a', [1, 'b'], None, True, 1.5, range(3), [])\n"],
    ["print without arguments", "print()\nprint('after')\n"],
    ["a name assigned twice", "x = 1\nx = x + 1\nx = x * 10\nprint(x)\n"],
    [
      "augmented assignment",
      "x = 10\nx += 5\nx -= 3\nx *= 2\nx //= 5\nx **= 2\nx %= 7\nprint(x)\nx /= 4\nprint(x)\n",
    ],
    ["augmented assignment on a string", "s = 'ab'\ns += 'c'\ns *= 2\nprint(s)\n"],
    ["a list changed in place by +=", "a = [1]\nb = a\nb += [2]\nprint(a, b, a is b)\n"],
    ["a list not changed by a = a +", "a = [1]\nb = a\nb = b + [2]\nprint(a, b, a is b)\n"],
    ["+= takes any iterable on a list", "a = [1]\na += range(3)\na += 'xy'\nprint(a)\n"],
    ["*= on a list", "a = [1, 2]\nb = a\na *= 2\nprint(a, b is a)\n"],
    ["item assignment", "xs = [1, 2, 3]\nxs[0] = 10\nxs[-1] = 30\nprint(xs)\n"],
    ["augmented item assignment", "xs = [1, 2, 3]\nxs[1] += 5\nxs[-1] *= 2\nprint(xs)\n"],
    ["aliasing", "a = [1, 2]\nb = a\nb[0] = 99\nprint(a, b)\n"],
    ["a list that contains itself", "a = [1]\na[0] = a\nprint(a)\n"],
    [
      "nested lists",
      "m = [[0] * 2] * 2\nm[0][0] = 1\nprint(m)\nn = [[0, 0], [0, 0]]\nn[0][0] = 1\nprint(n)\n",
    ],
    [
      "if / elif / else",
      "def sign(n):\n    if n > 0:\n        return 1\n    elif n < 0:\n        return -1\n    else:\n        return 0\nprint(sign(5), sign(-5), sign(0))\n",
    ],
    [
      "truthiness in if",
      "for v in [0, 1, '', 'x', [], [0], None, 0.0, 2.5]:\n    if v:\n        print('true', v)\n    else:\n        print('false', v)\n",
    ],
    ["while", "i = 0\nwhile i < 5:\n    print(i)\n    i += 1\n"],
    [
      "while with break and continue",
      "i = 0\nwhile True:\n    i += 1\n    if i % 2 == 0:\n        continue\n    if i > 7:\n        break\n    print(i)\n",
    ],
    ["for over range", "total = 0\nfor i in range(10):\n    total += i\nprint(total)\n"],
    [
      "for over range with a start and a step",
      "for i in range(10, 0, -3):\n    print(i)\nfor i in range(2, 9, 3):\n    print(i)\n",
    ],
    ["for over a list", "for x in [3, 1, 2]:\n    print(x * x)\n"],
    ["for over a string", "for ch in 'abc':\n    print(ch)\n"],
    ["for over an empty range", "for i in range(0):\n    print('never')\nprint('done')\n"],
    ["the loop variable stays", "for i in range(3):\n    pass\nprint(i)\n"],
    [
      "for with break and continue",
      "for i in range(10):\n    if i == 2:\n        continue\n    if i == 6:\n        break\n    print(i)\n",
    ],
    [
      "nested loops",
      "for i in range(3):\n    for j in range(3):\n        if j > i:\n            break\n        print(i, j)\n",
    ],
    [
      "a list that grows during iteration",
      "xs = [1, 2]\nfor x in xs:\n    if len(xs) < 6:\n        xs += [x + 10]\nprint(xs)\n",
    ],
    [
      "a list that is rebound during iteration",
      "xs = [1, 2, 3]\nfor x in xs:\n    xs = xs + [0]\nprint(xs)\n",
    ],
    ["pass", "def f():\n    pass\nprint(f())\nif True:\n    pass\n"],
    ["a function without return", "def f(x):\n    y = x + 1\nprint(f(1))\n"],
    [
      "return in a loop",
      "def find(xs, t):\n    for i in range(len(xs)):\n        if xs[i] == t:\n            return i\n    return -1\nprint(find([5, 6, 7], 7), find([5, 6, 7], 9))\n",
    ],
    [
      "return in a while loop",
      "def first_square_over(n):\n    i = 0\n    while True:\n        if i * i > n:\n            return i\n        i += 1\nprint(first_square_over(50))\n",
    ],
    ["a bare return", "def f(x):\n    if x:\n        return\n    return 1\nprint(f(1), f(0))\n"],
    [
      "lambda",
      "f = lambda x, y: x * y + 1\nprint(f(3, 4))\nprint((lambda: 7)())\nprint((lambda x: x + 1)(1))\n",
    ],
    [
      "higher-order functions",
      "def twice(f, x):\n    return f(f(x))\nprint(twice(lambda x: x * 3, 2))\ndef compose(f, g):\n    return lambda x: f(g(x))\nprint(compose(abs, lambda x: x - 10)(3))\n",
    ],
    [
      "functions in a list",
      "fs = [lambda x: x + 1, lambda x: x * 2]\nprint(fs[0](10), fs[1](10))\n",
    ],
    [
      "a function that prints",
      "def hello(name):\n    print('hello', name)\nhello('a')\nhello('b')\n",
    ],
    ["a function value", "def f():\n    return 1\ng = f\nprint(g(), f is g, f == g)\n"],
    [
      "a comparison of functions",
      "def f(): return 1\ndef g(): return 1\nprint(f == g, f != g, f == f)\n",
    ],
  ])("%s", (_, code) => same(code));
});

describeIfCPython("recursion and closures", () => {
  test.each<[string, string]>([
    [
      "factorial",
      "def fact(n):\n    return 1 if n == 0 else n * fact(n - 1)\nprint(fact(5), fact(20), fact(30))\n",
    ],
    [
      "fibonacci",
      "def fib(n):\n    if n < 2:\n        return n\n    return fib(n - 1) + fib(n - 2)\nprint(fib(12))\n",
    ],
    [
      "mutual recursion",
      "def even(n):\n    return True if n == 0 else odd(n - 1)\ndef odd(n):\n    return False if n == 0 else even(n - 1)\nprint(even(10), odd(7), even(7))\n",
    ],
    [
      "the sum of a list",
      "def total(xs, i):\n    return 0 if i == len(xs) else xs[i] + total(xs, i + 1)\nprint(total([1, 2, 3, 4], 0))\n",
    ],
    [
      "the Ackermann function",
      "def ack(m, n):\n    if m == 0:\n        return n + 1\n    elif n == 0:\n        return ack(m - 1, 1)\n    else:\n        return ack(m - 1, ack(m, n - 1))\nprint(ack(2, 3))\n",
    ],
    [
      "a recursion that is deep, but not too deep",
      "def count(n):\n    return 0 if n == 0 else 1 + count(n - 1)\nprint(count(500))\n",
    ],
    [
      "a recursion that is too deep",
      "def forever(n):\n    return forever(n + 1)\nprint('start')\nforever(0)\nprint('never')\n",
    ],
    [
      "make_withdraw",
      "def make_withdraw(balance):\n    def withdraw(amount):\n        nonlocal balance\n        if balance >= amount:\n            balance = balance - amount\n            return balance\n        else:\n            return 'Insufficient funds'\n    return withdraw\nw1 = make_withdraw(100)\nprint(w1(50))\nprint(w1(30))\nprint(w1(40))\nw2 = make_withdraw(100)\nprint(w2(100))\n",
    ],
    [
      "a counter",
      "def make_counter():\n    n = 0\n    def counter():\n        nonlocal n\n        n += 1\n        return n\n    return counter\nc = make_counter()\nd = make_counter()\nprint(c(), c(), d(), c())\n",
    ],
    [
      "a closure sees later assignments",
      "def make():\n    x = 1\n    def get():\n        return x\n    x = 2\n    return get\nprint(make()())\n",
    ],
    [
      "a closure over a parameter",
      "def adder(n):\n    return lambda x: x + n\nadd5 = adder(5)\nprint(add5(1), adder(10)(1))\n",
    ],
    [
      "nested closures",
      "def a(x):\n    def b(y):\n        def c(z):\n            return x + y + z\n        return c\n    return b\nprint(a(1)(2)(3))\n",
    ],
    [
      "a global changed by a function",
      "count = 0\ndef bump():\n    global count\n    count += 1\nbump()\nbump()\nprint(count)\n",
    ],
    [
      "a global read by a function",
      "g = 10\ndef f():\n    return g + 1\nprint(f())\ng = 20\nprint(f())\n",
    ],
    [
      "a global defined by a function",
      "def f():\n    global fresh\n    fresh = 5\nf()\nprint(fresh)\n",
    ],
    ["a local that shadows a global", "x = 1\ndef f():\n    x = 2\n    return x\nprint(f(), x)\n"],
    [
      "a parameter that shadows a global",
      "x = 1\ndef f(x):\n    x = x + 1\n    return x\nprint(f(10), x)\n",
    ],
    [
      "nonlocal in two levels",
      "def a():\n    n = 0\n    def b():\n        def c():\n            nonlocal n\n            n += 1\n        c()\n        c()\n    b()\n    return n\nprint(a())\n",
    ],
    [
      "a function that defines functions",
      "def outer():\n    def inner():\n        return 'inner'\n    return inner()\nprint(outer())\n",
    ],
    [
      "a function that is redefined",
      "def f():\n    return 1\nprint(f())\ndef f():\n    return 2\nprint(f())\n",
    ],
    ["a built-in that is shadowed", "len = 3\nprint(len)\n"],
    [
      "a built-in that is shadowed in a function",
      "def f():\n    abs = 5\n    return abs\nprint(f(), abs(-1))\n",
    ],
  ])("%s", (_, code) => same(code));
});

describeIfCPython("errors in programs", () => {
  test.each<[string, string]>([
    ["a local used before its assignment", "x = 1\ndef f():\n    print(x)\n    x = 2\nf()\n"],
    [
      "a local that is assigned only in a branch",
      "def f():\n    if False:\n        y = 1\n    return y\nf()\n",
    ],
    ["an augmented assignment of an unassigned local", "def f():\n    n += 1\nf()\n"],
    [
      "a free variable that is not assigned yet",
      "def outer():\n    def inner():\n        return v\n    r = inner()\n    v = 1\n    return r\nouter()\n",
    ],
    ["a name that is not defined, in a function", "def f():\n    return nothing\nf()\n"],
    ["a name that is not defined yet", "print(later)\nlater = 1\n"],
    ["too many arguments", "def f(a):\n    return a\nf(1, 2)\n"],
    ["too few arguments", "def f(a, b):\n    return a\nf(1)\n"],
    ["no arguments for a function that has parameters", "def f(a):\n    return a\nf()\n"],
    ["arguments for a function that has none", "def f():\n    return 1\nf(1)\n"],
    ["too few arguments for a lambda", "(lambda x, y: x)(1)\n"],
    [
      "a division by zero in a called function",
      "def f(x):\n    return 1 / x\nprint(f(1))\nprint(f(0))\n",
    ],
    ["an index error after output", "xs = [1, 2]\nfor i in range(5):\n    print(xs[i])\n"],
    ["a call of a number", "x = 5\nx()\n"],
    ["a for over a number", "for i in 5:\n    pass\n"],
    ["a for over None", "for i in None:\n    pass\n"],
    ["item assignment to a string", "s = 'abc'\ns[0] = 'x'\n"],
    ["item assignment to a number", "n = 1\nn[0] = 2\n"],
    ["an index error in item assignment", "xs = [1]\nxs[5] = 2\n"],
    ["+= of a number on a list", "xs = [1]\nxs += 5\n"],
    ["a recursion error that is caught by nothing", "def f(n):\n    return f(n) + 1\nf(1)\n"],
    ["return outside a function", "print('not printed')\nreturn 1\n"],
    ["break outside a loop", "print('not printed')\nbreak\n"],
    ["continue outside a loop", "print('not printed')\ncontinue\n"],
    ["a break in a function in a loop", "for i in range(3):\n    def f():\n        break\n"],
    ["a syntax error", "print('not printed')\nx = \n"],
    ["a bad indentation", "if True:\nprint(1)\n"],
    ["an unexpected indent", "x = 1\n    y = 2\n"],
  ])("%s", (_, code) => same(code));
});

describeIfCPython("review of the first slice: order of evaluation, declarations, huge ints", () => {
  const trace = "def t(tag, v):\n    print(tag)\n    return v\n";
  test.each<[string, string]>([
    [
      "a subscript assignment evaluates the right-hand side first",
      `${trace}a = [0, 0]\nt('obj', a)[t('index', 1)] = t('rhs', 5)\nprint(a)\n`,
    ],
    [
      "an augmented subscript assignment reads the element before the right-hand side",
      "a = [1]\ndef f():\n    a[0] = 10\n    return 2\na[0] += f()\nprint(a)\n",
    ],
    [
      "an augmented subscript assignment evaluates object, index, element, right-hand side",
      `${trace}a = [1, 2]\nt('obj', a)[t('index', 1)] += t('rhs', 5)\nprint(a)\n`,
    ],
    [
      "a nonlocal without a binding is reported before anything runs",
      "print('before')\ndef f():\n    nonlocal missing\n    print('after')\n",
    ],
    ["nonlocal at module level", "print('before')\nnonlocal x\n"],
    ["a parameter that is also global", "print('before')\ndef f(x):\n    global x\n"],
    ["a parameter that is also nonlocal", "def g(x):\n    def f(x):\n        nonlocal x\n"],
    [
      "a name that is both global and nonlocal",
      "def g():\n    x = 1\n    def f():\n        global x\n        nonlocal x\n",
    ],
    [
      "a nonlocal that skips a function with the same global",
      "def a():\n    x = 1\n    def b():\n        global x\n        def c():\n            nonlocal x\n",
    ],
    [
      "a free variable stops at an enclosing global declaration",
      "x = 'module'\ndef outer():\n    x = 'outer'\n    def middle():\n        global x\n        def inner():\n            return x\n        return inner()\n    return middle()\nprint(outer())\n",
    ],
    [
      "a valid nonlocal chain",
      "def a():\n    x = 1\n    def b():\n        nonlocal x\n        def c():\n            nonlocal x\n            x += 1\n        c()\n    b()\n    return x\nprint(a())\n",
    ],
    [
      "huge ints against infinities",
      "inf = float('inf')\nbig = 10 ** 1000\nprint(big < inf, big > inf, big <= inf, -big > -inf, -big < -inf, inf > big, -inf < -big, big == inf, big != inf, inf == big)\n",
    ],
    [
      "huge ints against finite floats",
      "print(10 ** 1000 > 1e300, -(10 ** 1000) < -1e300, 10 ** 400 < 1e308)\n",
    ],
  ])("%s", (_, code) => same(code));
});

describeIfCPython("review of the first slice, second round: declaration order, code points", () => {
  test.each<[string, string]>([
    [
      "a name assigned before its global declaration",
      "print('before')\ndef f():\n    x = 1\n    global x\n",
    ],
    [
      "a name used before its global declaration",
      "print('before')\ndef f():\n    print(x)\n    global x\n",
    ],
    [
      "a name assigned before its nonlocal declaration",
      "def g():\n    x = 0\n    def f():\n        x = 1\n        nonlocal x\n",
    ],
    [
      "a name used before its nonlocal declaration",
      "def g():\n    x = 0\n    def f():\n        print(x)\n        nonlocal x\n",
    ],
    ["a name assigned before global at module level", "print('before')\nx = 1\nglobal x\n"],
    ["an augmented assignment before the declaration", "def f():\n    x += 1\n    global x\n"],
    [
      "a for target before the declaration",
      "def f():\n    for x in [1]:\n        pass\n    global x\n",
    ],
    [
      "a use in a nested if before the declaration",
      "def f():\n    if True:\n        print(x)\n    global x\n",
    ],
    [
      "a use inside a lambda or a nested function is not a use of the scope",
      "x = 1\ndef f():\n    g = lambda: x\n    def h():\n        return x\n    global x\n    return g() + h()\nprint(f())\n",
    ],
    [
      "the declaration first is fine",
      "x = 1\ndef f():\n    global x\n    x = 2\n    x += 1\nf()\nprint(x)\n",
    ],
    [
      "a declaration in a loop body after use",
      "def f():\n    while True:\n        print(x)\n        global x\n",
    ],
    [
      "strings compare by code point, not by UTF-16 unit",
      "print('\u{10000}' < '\ue000', '\ue000' < '\u{10000}', 'a' < 'b', 'ab' < 'a')\n",
    ],
    [
      "lists of such strings",
      "print(['\u{10000}'] < ['\ue000'], min('\u{10000}', '\ue000') == '\ue000', max('\u{10000}', '\ue000') == '\u{10000}')\n",
    ],
  ])("%s", (_, code) => same(code));
});

describeIfCPython(
  "review of the first slice, third round: ranges, parameters, hidden bindings",
  () => {
    test.each<[string, string]>([
      ["list of a range longer than an index", "print('before')\nlist(range(10 ** 100))\n"],
      ["len of a range longer than an index", "print(len(range(10 ** 100)))\n"],
      ["a list extended by a range longer than an index", "a = []\na += range(10 ** 100)\n"],
      [
        "len of a long range that fits",
        "print(len(range(10 ** 18)), len(range(0, 10 ** 18, 7)))\n",
      ],
      [
        "a for loop over a huge range is lazy",
        "for i in range(10 ** 100):\n    print(i)\n    if i == 2:\n        break\n",
      ],
      ["a duplicate parameter", "print('before')\ndef f(x, x):\n    pass\n"],
      [
        "a duplicate parameter in a nested function",
        "print('before')\ndef g():\n    def f(a, b, a):\n        pass\n",
      ],
      ["a duplicate parameter of a lambda", "print('before')\nf = lambda y, y: y\n"],
      ["distinct parameters", "def f(x, y):\n    return x - y\nprint(f(5, 2))\n"],
      [
        "a name bound by unpacking in a function is local",
        "x = 'module'\ndef f():\n    print(x)\n    if False:\n        x, y = [1, 2]\nf()\n",
      ],
      [
        "a name bound by unpacking in a for loop is local",
        "x = 'module'\ndef f():\n    print(x)\n    for x, y in []:\n        pass\nf()\n",
      ],
      [
        "a name bound by an import is local",
        "os = 'module'\ndef f():\n    print(os)\n    if False:\n        import os\nf()\n",
      ],
      [
        "a name bound by a class statement is local",
        "C = 'module'\ndef f():\n    print(C)\n    if False:\n        class C:\n            pass\nf()\n",
      ],
      [
        "a name bound by an except clause is local",
        "e = 'module'\ndef f():\n    print(e)\n    try:\n        pass\n    except Exception as e:\n        pass\nf()\n",
      ],
      [
        "a name bound by with is local",
        "w = 'module'\ndef f():\n    print(w)\n    if False:\n        with open('x') as w:\n            pass\nf()\n",
      ],
      [
        "a name deleted in a function is local",
        "d = 'module'\ndef f():\n    print(d)\n    if False:\n        del d\nf()\n",
      ],
    ])("%s", (_, code) => same(code));
  },
);

describeIfCPython("review of the first slice, fourth round: big numbers, special powers", () => {
  test.each<[string, string]>([
    ["a huge int that is never printed", "x = 10 ** 5000\nprint('ok')\n"],
    ["a huge int that is compared", "x = 10 ** 5000\nprint(x > 1, x == x, len([x]))\n"],
    ["a huge int that is printed", "x = 10 ** 5000\nprint(x)\n"],
    ["a huge int in a list that is printed", "print([10 ** 5000])\n"],
    ["a huge int that is converted by str", "print(len(str(10 ** 4000)))\nstr(10 ** 5000)\n"],
    ["a list extended by a long range", "a = []\na += range(300000)\nprint(len(a), a[-1])\n"],
    [
      "a long list repeated",
      "a = list(range(200000))\nb = a * 3\nprint(len(b), b[-1])\nc = a\nc *= 2\nprint(len(c))\n",
    ],
    [
      "a negative zero to odd integer powers",
      "x = -0.0\nprint(repr(x ** 3), repr(x ** 5), repr(x ** 4), repr(x ** 1))\n",
    ],
    [
      "zero to an infinite exponent",
      "print(0.0 ** float('inf'), 0.0 ** -float('inf'), 0 ** -float('inf'))\n",
    ],
    [
      "minus one to an infinite exponent",
      "print((-1.0) ** float('inf'), (-1.0) ** -float('inf'), 1.0 ** float('inf'), 1 ** float('nan'))\n",
    ],
    [
      "other bases to infinite exponents",
      "inf = float('inf')\nprint(2.0 ** inf, 2.0 ** -inf, 0.5 ** inf, 0.5 ** -inf, -2.0 ** inf, (-2.0) ** -inf, 3 ** inf)\n",
    ],
    [
      "nan powers",
      "nan = float('nan')\nprint(nan ** 0, nan ** 0.0, 1.0 ** nan, 2.0 ** nan, nan ** 2)\n",
    ],
    [
      "infinite bases",
      "inf = float('inf')\nprint(inf ** 2, inf ** -2, (-inf) ** 3, (-inf) ** 2, (-inf) ** -3, inf ** 0)\n",
    ],
    ["a string repeated by a count that is no index", "'x' * (10 ** 100)\n"],
    ["a list repeated by a negative count that is no index", "print([] * -(10 ** 100))\n"],
    ["a string repeated by a negative count that is no index", "print('a' * -(10 ** 100))\n"],
    [
      "an empty string repeated by a large count",
      "print(repr('' * 10 ** 18), repr([] * 10 ** 18))\n",
    ],
    ["a count at the edge of an index", "x = 'ab' * (-(2 ** 63))\nprint(repr(x))\n"],
  ])("%s", (_, code) => same(code));
});

describeIfCPython("review of the first slice, fifth round: powers, lists, unicode, ranges", () => {
  test.each<[string, string]>([
    ["a power above the old exponent cutoff", "x = 2 ** 100001\nprint(x > 0, x % 1000)\n"],
    [
      "a large power of a small base",
      "x = 3 ** 200000\nprint(x % 1000, len(str(x // 10 ** 90000)) if False else 1)\n",
    ],
    [
      "the parity of a huge negative exponent",
      "print((-1) ** -(10 ** 20 + 1), (-1) ** -(10 ** 20), (-2) ** -(10 ** 20 + 1), (-2) ** -(10 ** 20))\n",
    ],
    [
      "a negative exponent below the exact range",
      "print(repr((-2) ** -5001), repr((-2) ** -5002), repr(2 ** -5001))\n",
    ],
    [
      "a list that holds the same nan twice",
      "n = float('nan')\nprint([n] == [n], [n] <= [n], [n] != [n], [n] < [n], [n] in [[n]])\n",
    ],
    [
      "a list with a nan and other elements",
      "n = float('nan')\nprint([1, n, 3] == [1, n, 3], [1, n, 3] < [1, n, 4])\n",
    ],
    [
      "int of unicode digits",
      "print(int('\u0661\u0662'), int('\uff11\uff12'), int('\u0967_\u0968'), int(' \u0669 '))\n",
    ],
    ["float of unicode digits", "print(float('\uff11\uff12.\uff15'), float('\u0661e\u0662'))\n"],
    ["an int that is not a number", "int('\u00b2')\n"],
    [
      "repr of control and format characters",
      "print(repr('\x85'), repr('\xa0'), repr('\u200b'), repr('\u2028'), repr('a b'), repr('\xad'))\n",
    ],
    [
      "repr of private use and wide characters",
      "print(repr('\ue000'), repr('\u{10ffff}'), repr('\u{1f600}'), repr('\u00e9'), repr('\u4e2d'))\n",
    ],
    ["a list of strings with such characters", "print(['\x85', '\u200b'])\n"],
    ["repr of a range with huge endpoints", "print('before')\nprint(range(10 ** 5000))\n"],
    ["a range with big endpoints that is not printed", "r = range(10 ** 5000)\nprint(len([r]))\n"],
    ["repr of a range with endpoints that fit", "print(range(10 ** 30, 10 ** 31, 10 ** 29))\n"],
  ])("%s", (_, code) => same(code));
});

describeIfCPython(
  "review of the first slice, sixth round: membership in ranges, compile errors in compound statements",
  () => {
    test.each<[string, string]>([
      [
        "membership of every kind of value in a small range",
        "r = range(0, 10, 2)\nprint(2.0 in r, 3.0 in r, 0.5 in r, -0.0 in r, 'a' in r, None in r, True in r, False in r, [2] in r, float('nan') in r, float('inf') in r, 8 in r, 10 in r, -2 in r)\n",
      ],
      [
        "membership in an empty and a descending range",
        "print(1.0 in range(0), 5.0 in range(10, 0, -5), 4.0 in range(10, 0, -5), 6.0 in range(10, 0, -3))\n",
      ],
      ["return in a class body", "print('before')\nclass C:\n    return 1\n"],
      [
        "return in a class body inside a function",
        "print('before')\ndef f():\n    class C:\n        return 1\n",
      ],
      [
        "break in a class body inside a loop",
        "print('before')\nwhile True:\n    class C:\n        break\n",
      ],
      [
        "return in a try statement",
        "print('before')\ntry:\n    return 1\nexcept Exception:\n    pass\n",
      ],
      [
        "break in an except clause",
        "print('before')\ntry:\n    pass\nexcept Exception:\n    break\n",
      ],
      [
        "continue in a finally clause outside a loop",
        "print('before')\ntry:\n    pass\nfinally:\n    continue\n",
      ],
      ["return in a with statement", "print('before')\nwith open('x') as f:\n    return 1\n"],
      ["return in an unpacking loop", "print('before')\nfor a, b in []:\n    return 1\n"],
      [
        "break in an unpacking loop is fine, a continue after it is not",
        "print('before')\nfor a, b in []:\n    break\ncontinue\n",
      ],
      [
        "a missing nonlocal in a decorated function",
        "print('before')\n@d\ndef f():\n    nonlocal missing\n",
      ],
      [
        "a duplicate parameter in a class method",
        "print('before')\nclass C:\n    def m(self, self):\n        pass\n",
      ],
      [
        "a nonlocal without a binding in a class method",
        "print('before')\nclass C:\n    def m(self):\n        nonlocal missing\n",
      ],
    ])("%s", (_, code) => same(code));
  },
);

describe("membership in a huge range does not scan it", () => {
  test.each<[string, string]>([
    ["0.5", "print(0.5 in range(10 ** 100))"],
    ["a string", "print('a' in range(10 ** 100))"],
    ["None", "print(None in range(10 ** 100))"],
    ["nan", "print(float('nan') in range(10 ** 100))"],
    ["infinity", "print(float('inf') in range(10 ** 100), -float('inf') in range(10 ** 100))"],
    [
      "an integral float",
      "print(5.0 in range(10 ** 100), 1e30 in range(10 ** 100), 1e30 in range(10 ** 20))",
    ],
  ])("%s", (_, code) => {
    const result = evaluate(code, 1000);
    expect(result.error).toBeNull();
    expect(result.output).toMatch(/^(True|False)/);
  });

  test("the answers", () => {
    expect(
      evaluate(
        "print(0.5 in range(10 ** 100), 5.0 in range(10 ** 100), 'a' in range(10 ** 100), 1e30 in range(10 ** 100), 1e30 in range(10 ** 20))",
        1000,
      ).output,
    ).toBe("False True False True False\n");
  });
});

describeIfCPython(
  "review of the first slice, seventh round: shadowed built-ins, digits, powers, cycles",
  () => {
    const shadow = "def f():\n    global print\n    print = 1\n    return 2\n";
    test.each<[string, string]>([
      ["a built-in callee is loaded before the arguments run", `${shadow}print(f())\n`],
      [
        "a built-in callee shadowed by a later argument, with another argument",
        `${shadow}print(1, f(), 3)\n`,
      ],
      [
        "a built-in operand is loaded before the next operand runs",
        "def f():\n    global len\n    len = 0\n    return 1\nprint([len, f()][0] is not 0)\n",
      ],
      [
        "a built-in in a list literal",
        "def f():\n    global len\n    len = 0\n    return 1\nx = [len, f()]\nprint(x[0]([1, 2]), len)\n",
      ],
      [
        "a built-in operand of a comparison",
        "def f():\n    global len\n    len = 0\n    return 1\nprint(len == f(), len)\n",
      ],
      [
        "a user function called after a global rebinding",
        "def g():\n    return 'old'\ndef f():\n    global g\n    g = lambda: 'new'\n    return 2\nprint(g(), f(), g())\nprint(g(), f())\n",
      ],
      ["int of a string of 4300 digits", "print(len(str(int('1' * 4300))))\n"],
      ["int of a string of 4301 digits", "int('1' * 4301)\n"],
      [
        "int of a string with underscores and a sign near the limit",
        "print(len(str(int('-' + '1_' * 4299 + '1'))))\nint('+' + '1_' * 4300 + '1')\n",
      ],
      [
        "negative infinity to fractional powers",
        "inf = float('inf')\nprint(-inf ** 0.5, (-inf) ** 0.5, (-inf) ** 1.5, (-inf) ** -0.5, (-inf) ** 0.0)\n",
      ],
      ["equal cyclic lists", "a = [None]\na[0] = a\nb = [None]\nb[0] = b\nprint(a == b)\n"],
      ["ordered cyclic lists", "a = [None]\na[0] = a\nb = [None]\nb[0] = b\nprint(a < b)\n"],
      ["a cyclic list equal to itself", "a = [None]\na[0] = a\nprint(a == a, a != a)\n"],
      [
        "deep but finite lists",
        "a = []\nfor i in range(100):\n    a = [a]\nb = []\nfor i in range(100):\n    b = [b]\nprint(a == b, a < b)\n",
      ],
    ])("%s", (_, code) => same(code));
  },
);

describeIfCPython(
  "review of the first slice, eighth round: literals, yield, print, int with a base",
  () => {
    const big = (n: number) => "9".repeat(n);
    test.each<[string, string]>([
      [
        "a decimal literal of 4300 digits",
        `x = ${big(4300)}\nprint(len(str(x)) if False else 1)\n`,
      ],
      ["a decimal literal of 4301 digits", `print('before')\nx = ${big(4301)}\nprint('after')\n`],
      ["a hex literal of many digits is fine", `x = 0x${"f".repeat(5000)}\nprint(x > 0)\n`],
      ["yield outside a function", "print('before')\nyield 1\n"],
      ["yield in an expression outside a function", "print('before')\nx = (yield)\n"],
      ["yield in a class body", "print('before')\nclass C:\n    yield 1\n"],
      ["yield in an if at module level", "print('before')\nif True:\n    yield 1\n"],
      ["a print that fails after a first argument", "print('prefix', 10 ** 5000)\n"],
      [
        "a print that fails after two arguments",
        "print('a', 'b', 10 ** 5000, 'c')\nprint('not reached')\n",
      ],
      ["a string of many characters as a list", "x = list('x' * 100000)\nprint(len(x), x[-1])\n"],
      ["min and max of a long string", "s = 'abc' * 50000\nprint(min(s), max(s))\n"],
      [
        "a for loop over a string",
        "n = 0\nfor c in 'a\u{10000}bc':\n    n += 1\n    print(c, n)\n",
      ],
      [
        "int with a base",
        "print(int('10', 2), int('ff', 16), int('0xff', 16), int('0xff', 0), int('0b101', 0), int('0o17', 0), int('z', 36), int('-12', 5), int(' 7 ', 8), int('1_000', 10), int('0x_1f', 16), int('00', 0), int('0_0', 0))\n",
      ],
      ["int with a base: a digit too big", "int('12', 2)\n"],
      ["int with a base: a bad base", "int('1', 1)\n"],
      ["int with a base: a bad base 37", "int('1', 37)\n"],
      ["int with a base: a number, not a string", "int(10, 2)\n"],
      ["int with a base: a float base", "int('10', 2.0)\n"],
      ["int with base 0 and a leading zero", "int('010', 0)\n"],
      [
        "int with a base: a prefix of another base",
        "int('0b1', 16) if False else print(int('0b1', 16))\nint('0x1', 8)\n",
      ],
      ["int with a base: underscores", "int('1__0', 10)\n"],
      ["int with a base: a trailing underscore", "int('10_', 10)\n"],
      ["int with a base: empty", "int('', 2)\n"],
      ["int with a base: three arguments", "int('1', 2, 3)\n"],
      ["int with a base: too many digits in base 3", `int('1' * 4301, 3)\n`],
      ["int with a base: many digits in base 16", `print(int('f' * 5000, 16) > 0)\n`],
    ])("%s", (_, code) => same(code));
  },
);

describeIfCPython(
  "review of the first slice, ninth round: limits first, scopes of yield, all bindings",
  () => {
    test.each<[string, string]>([
      ["too many digits in base 3 are refused before the work", "int('1' * 10000000, 3)\n"],
      ["too many digits in base 10 with a sign and underscores", "int('-' + '1_' * 4300 + '1')\n"],
      ["many digits in base 2 are fine", "print(int('1' * 5000, 2) > 0)\n"],
      [
        "yield in a class in a function",
        "print('before')\ndef f():\n    class C:\n        yield 1\n",
      ],
      ["yield in a class in a class", "print('before')\nclass A:\n    class B:\n        yield 1\n"],
      ["yield in a function is fine", "def f():\n    yield 1\nprint('ok')\n"],
      ["unpacking before global", "print('before')\nx, y = [1, 2]\nglobal x\n"],
      [
        "unpacking before global in a function",
        "print('before')\ndef f():\n    x, y = [1, 2]\n    global x\n",
      ],
      [
        "a for-unpacking target before global",
        "print('before')\ndef f():\n    for x, y in []:\n        pass\n    global x\n",
      ],
      [
        "an import before global is not an error",
        "print('before')\ndef f():\n    import os\n    global os\nprint('after')\n",
      ],
      [
        "a class before global",
        "print('before')\ndef f():\n    class C:\n        pass\n    global C\n",
      ],
      [
        "an annotated assignment before global",
        "print('before')\ndef f():\n    x: int = 1\n    global x\n",
      ],
      [
        "a with target before global",
        "print('before')\ndef f():\n    with open('x') as w:\n        pass\n    global w\n",
      ],
      [
        "an except name before global",
        "print('before')\ndef f():\n    try:\n        pass\n    except Exception as e:\n        pass\n    global e\n",
      ],
      ["a del before global", "print('before')\ndef f():\n    del x\n    global x\n"],
      [
        "a use in a try before global",
        "print('before')\ndef f():\n    try:\n        print(x)\n    finally:\n        pass\n    global x\n",
      ],
    ])("%s", (_, code) => same(code));

    test.each([
      [
        "a method of a class in a function",
        "def f():\n    class C:\n        def m(self):\n            yield 1\n    return 1\nprint('ok')\n",
      ],
      ["a lambda in a class", "class C:\n    f = lambda: (yield)\nprint('ok')\n"],
    ])("yield is fine in %s (classes themselves are not supported yet)", (_, code) => {
      const result = evaluate(code, 1000);
      expect(result.error?.kind).not.toBe("SyntaxError");
    });

    test("nested loops over long strings stay linear", () => {
      const result = evaluate(
        'for a in "x" * 30000:\n    for b in "y":\n        pass\nprint("done")\n',
        2_000_000,
      );
      expect(result.error).toBeNull();
      expect(result.output).toBe("done\n");
    });
  },
);

describeIfCPython(
  "review of the first slice, tenth round: class scopes, all uses, power sizes",
  () => {
    test.each<[string, string]>([
      [
        "a class body that assigns before global",
        "print('before')\nclass C:\n    x = 1\n    global x\n",
      ],
      [
        "a class body that uses before global",
        "print('before')\nclass C:\n    print(x)\n    global x\n",
      ],
      [
        "a use in assert before global",
        "print('before')\ndef f():\n    assert x\n    global x\nprint('after')\n",
      ],
      [
        "a use in the message of assert before global",
        "print('before')\ndef f():\n    assert True, x\n    global x\n",
      ],
      ["a use in raise before global", "print('before')\ndef f():\n    raise x\n    global x\n"],
      [
        "a use in raise from before global",
        "print('before')\ndef f():\n    raise ValueError from x\n    global x\n",
      ],
      [
        "a use in an attribute assignment before global",
        "print('before')\ndef f():\n    x.y = 1\n    global x\n",
      ],
      ["an annotation before global", "print('before')\ndef f():\n    y: x = 1\n    global x\n"],
      ["2 ** 4000001", "x = 2 ** 4000001\nprint(x % 1000, x > 0)\n"],
      ["3 ** 2000000", "x = 3 ** 2000000\nprint(x % 1000)\n"],
      ["10 ** 2000000", "x = 10 ** 2000000\nprint(x % 1000)\n"],
      ["a power at the edge, (-2) ** 4000001", "x = (-2) ** 4000001\nprint(x % 1000, x < 0)\n"],
    ])("%s", (_, code) => same(code));

    test("a class body that declares first is not a syntax error (classes are unsupported yet)", () => {
      const result = evaluate("class C:\n    global x\n    x = 1\n", 1000);
      expect(result.error?.kind).not.toBe("SyntaxError");
    });

    test("a power beyond the limit is a MemoryError", () => {
      expect(evaluate("2 ** 9000000\n", 1000).error?.kind).toBe("MemoryError");
      expect(evaluate("(10 ** 5) ** 500000\n", 1000).error?.kind).toBe("MemoryError");
    });
  },
);

describeIfCPython(
  "review of the first slice, eleventh round: tiny quotients, class declarations, targets",
  () => {
    test.each<[string, string]>([
      [
        "a quotient of big ints far below one",
        "print(1 / 2 ** 960, 1 / 2 ** 1070, 1 / 2 ** 1080, 3 / 2 ** 1000, -1 / 2 ** 1000, 7 / 10 ** 400)\n",
      ],
      [
        "a quotient of big ints near the edge",
        "print(2 ** 1100 / 2 ** 1090, 10 ** 308 / 10 ** 3, (2 ** 1024 - 1) / 2 ** 10)\n",
      ],
      [
        "nonlocal without a binding in a class in a function",
        "print('before')\ndef f():\n    class C:\n        nonlocal x\nprint('after')\n",
      ],
      ["nonlocal at module level in a class", "print('before')\nclass C:\n    nonlocal x\n"],
      [
        "global and nonlocal in a class",
        "print('before')\ndef f():\n    x = 1\n    class C:\n        global x\n        nonlocal x\n",
      ],
      [
        "a use in a deletion target before global",
        "print('before')\ndef f():\n    del a[x]\n    global x\n",
      ],
      [
        "a use in an attribute deletion target before global",
        "print('before')\ndef f():\n    del x.y\n    global x\n",
      ],
      ["a plain del before global", "print('before')\ndef f():\n    del x\n    global x\n"],
      [
        "a use in a subscript target of unpacking before global",
        "print('before')\ndef f():\n    a[x], y = 1, 2\n    global x\n",
      ],
      [
        "an annotation of a name before global stays an error",
        "print('before')\ndef f():\n    y: x = 1\n    global x\n",
      ],
    ])("%s", (_, code) => same(code));
  },
);

describeIfCPython(
  "review of the first slice, twelfth round: expression scopes, string indexing, whitespace",
  () => {
    test.each<[string, string]>([
      [
        "a lambda default is a use in this scope",
        "print('before')\ndef f():\n    lambda a=x: a\n    global x\nprint('after')\n",
      ],
      [
        "a lambda body is not a use in this scope",
        "def f():\n    lambda a: x\n    global x\nprint('ok')\n",
      ],
      ["a lambda parameter is not a use", "def f():\n    lambda x: x\n    global x\nprint('ok')\n"],
      [
        "a comprehension variable is not a use in this scope",
        "def f():\n    [x for x in y]\n    global x\nprint('ok')\n",
      ],
      [
        "the first iterable of a comprehension is a use",
        "print('before')\ndef f():\n    [a for a in x]\n    global x\nprint('after')\n",
      ],
      [
        "a later iterable of a comprehension is not",
        "def f():\n    [a for a in b for c in x]\n    global x\nprint('ok')\n",
      ],
      [
        "the element of a comprehension is not",
        "def f():\n    [x for a in b]\n    global x\nprint('ok')\n",
      ],
      [
        "a condition of a comprehension is not",
        "def f():\n    [a for a in b if x]\n    global x\nprint('ok')\n",
      ],
      [
        "a lambda in a comprehension iterable: its default is a use",
        "print('before')\ndef f():\n    [a for a in [lambda q=x: q]]\n    global x\nprint('after')\n",
      ],
      ["string indexing", "s = 'a\u{10000}bc'\nprint(s[0], s[1], s[-1], s[-4], len(s))\ns[4]\n"],
      ["a string index out of range", "'abc'[-4]\n"],
      ["int with a byte order mark", "int('\ufeff1')\n"],
      ["float with a byte order mark", "float('\ufeff1.5')\n"],
      ["int with a base and a byte order mark", "int('\ufeff1', 8)\n"],
      [
        "int with Python's whitespace",
        "print(int(' \x85 7 \xa0'), int('\u20003\u3000'), int('\x85 12 \x0b', 8), float(' \x852.5\u2029 '))\n",
      ],
      [
        "int with a separator that str.isspace knows but the conversion does not",
        "int('\\x1c1\\x1d')\n",
      ],
      ["float with such a separator", "float(' \\x1e2.5 ')\n"],
      ["int with the whitespace JavaScript has and Python has not", "int('1\ufeff')\n"],
    ])("%s", (_, code) => same(code));

    test("indexing and len of a long string stay constant-time per step", () => {
      const code =
        "s = 'x' * 100000\nn = 0\nfor i in range(20000):\n    n += len(s) + len(s[i])\nprint(n)\n";
      const result = evaluate(code, 2_000_000);
      expect(result.error).toBeNull();
      expect(result.output).toBe(String(20000 * (100000 + 1)) + "\n");
    });
  },
);

describeIfCPython("review of the first slice, thirteenth round: defaults, leading zeros", () => {
  test.each<[string, string]>([
    ["yield in a default of a def", "print('before')\ndef f(x=(yield 1)):\n    pass\n"],
    ["yield in a default of a lambda", "print('before')\nf = lambda x=(yield 1): x\n"],
    [
      "yield in a default of a method of a class in a function",
      "print('before')\ndef g():\n    def h(x=(yield)):\n        pass\n    return 1\n",
    ],
    ["yield in the body of a def is fine", "def f():\n    yield 1\nprint('ok')\n"],
    [
      "yield in a default of an inner def inside a generator is fine",
      "def f():\n    def g(x=(yield)):\n        pass\n    return 1\nprint('ok')\n",
    ],
    ["a decimal literal with leading zeros", "print('before')\nx = 0123\n"],
    ["a decimal literal with leading zeros and underscores", "print('before')\nx = 00_1\n"],
    ["zeros only are fine", "print(00, 000, 0)\n"],
    ["a float with leading zeros is fine", "print(0123.5, 0123e1, 00.5)\n"],
    ["other prefixes are fine", "print(0x10, 0o17, 0b101, 0X1F)\n"],
    ["leading zeros in a function body", "print('before')\ndef f():\n    return 0777\n"],
  ])("%s", (_, code) => same(code));

  test("two oversized strings in nested loops keep both materializations", () => {
    // Not run at the size of the cache limit (8 million), which would take hundreds of megabytes;
    // this checks the nested-loop result at a size that fits the normal cache.
    const result = evaluate(
      "n = 0\nfor a in 'x' * 3000:\n    for b in 'y' * 30:\n        n += 1\nprint(n)\n",
      2_000_000,
    );
    expect(result.error).toBeNull();
    expect(result.output).toBe("90000\n");
  });
});

describeIfCPython(
  "review of the first slice, fourteenth round: yield in comprehensions, string loops",
  () => {
    test.each<[string, string]>([
      [
        "yield in a list comprehension in a function",
        "print('before')\ndef f():\n    [(yield x) for x in []]\nprint('after')\n",
      ],
      [
        "yield in a set comprehension in a function",
        "print('before')\ndef f():\n    {(yield) for x in []}\n",
      ],
      [
        "yield in a dict comprehension in a function",
        "print('before')\ndef f():\n    {x: (yield) for x in []}\n",
      ],
      [
        "yield in a generator expression in a function",
        "print('before')\ndef f():\n    ((yield) for x in [])\n",
      ],
      [
        "yield in a condition of a comprehension",
        "print('before')\ndef f():\n    [x for x in [] if (yield)]\n",
      ],
      ["yield in a comprehension at module level", "print('before')\n[(yield 1) for x in []]\n"],
      [
        "yield in a later iterable of a comprehension",
        "print('before')\ndef f():\n    [a for a in [] for b in (yield)]\n",
      ],
      [
        "yield in the first iterable of a comprehension is fine",
        "def f():\n    [a for a in (yield)]\nprint('ok')\n",
      ],
      [
        "yield in a lambda in a comprehension is fine",
        "def f():\n    [lambda: (yield) for x in []]\nprint('ok')\n",
      ],
      [
        "a for loop over a string with a break",
        "for c in 'a\u{10000}bc':\n    print(c)\n    if c == 'b':\n        break\nprint('done')\n",
      ],
      [
        "nested for loops over strings",
        "for a in 'ab':\n    for b in 'xy':\n        print(a + b)\n",
      ],
      [
        "a for loop over a string that its body rebinds",
        "s = 'abc'\nfor c in s:\n    s = 'xyz'\n    print(c)\nprint(s)\n",
      ],
    ])("%s", (_, code) => same(code));
  },
);

describeIfCPython(
  "review of the first slice, fifteenth round: loaded right-hand sides, class bases",
  () => {
    const rebind = "p = print\nL = [0]\ndef f():\n    global print\n    print = 0\n    return L\n";
    test.each<[string, string]>([
      [
        "a built-in on the right of an item assignment is loaded first",
        `${rebind}f()[0] = print\np(L[0] is p)\n`,
      ],
      [
        "a built-in on the right of an item assignment, object a name",
        `${rebind}M = [0]\nM[f()[0]] = print\np(M[0] is p)\n`,
      ],
      [
        "a yield in the base of a class in a function is fine",
        "def f():\n    class C((yield 1)):\n        pass\n    return 1\nprint('ok')\n",
      ],
      [
        "a yield in the base of a class at module level",
        "print('before')\nclass C((yield 1)):\n    pass\n",
      ],
      [
        "a yield in the body of a class in a function is not",
        "print('before')\ndef f():\n    class C(object):\n        x = (yield 1)\n",
      ],
    ])("%s", (_, code) => same(code));
  },
);

describeIfCPython("review of the first slice, sixteenth round: separate nans", () => {
  const nan = "n = float('nan')\n";
  test.each<[string, string]>([
    [
      "two nans made separately in lists",
      "print([float('nan')] == [float('nan')], [float('nan')] != [float('nan')])\n",
    ],
    ["one nan twice in lists", `${nan}print([n] == [n], [n] != [n], [n] <= [n], [n] < [n])\n`],
    ["a nan in a list it was not made for", "print(float('nan') in [float('nan')])\n"],
    ["one nan in a list", `${nan}print(n in [n], n in [1, n], n in [1, 2])\n`],
    [
      "a nan passed through a function",
      `${nan}def f(v):\n    return v\nprint([f(n)] == [n], f(n) in [n])\n`,
    ],
    ["a nan copied to another name", `${nan}m = n\nprint([m] == [n], m in [n])\n`],
    ["a nan fetched from a list", `${nan}a = [n]\nb = [a[0]]\nprint(a == b, a[0] in b)\n`],
    ["nested lists with one nan", `${nan}print([[n]] == [[n]], [[n], 1] == [[n], 1])\n`],
    ["nested lists with separate nans", "print([[float('nan')]] == [[float('nan')]])\n"],
    [
      "a nan computed twice from the same expression",
      "a = float('inf') - float('inf')\nb = float('inf') - float('inf')\nprint([a] == [b], [a] == [a])\n",
    ],
    ["a nan and a number", `${nan}print([n] == [1], [1] == [n], 1 in [n])\n`],
  ])("%s", (_, code) => same(code));
});

describeIfCPython(
  "review of the first slice, seventeenth round: annotated globals, repeated keywords, unary plus",
  () => {
    test.each<[string, string]>([
      [
        "an annotated assignment after global",
        "print('before')\ndef f():\n    global x\n    x: int = 1\nprint('after')\n",
      ],
      [
        "an annotation without a value of a global name",
        "print('before')\ndef f():\n    global x\n    x: int\n",
      ],
      [
        "an annotated assignment after nonlocal",
        "print('before')\ndef g():\n    x = 0\n    def f():\n        nonlocal x\n        x: int = 1\n",
      ],
      [
        "an annotated assignment in a class with a global name",
        "print('before')\nclass C:\n    global x\n    x: int = 2\n",
      ],
      [
        "an annotated assignment of another name is fine",
        "def f():\n    global x\n    y: int = 1\nprint('ok')\n",
      ],
      [
        "an annotated global name in an inner function is not that of the outer one",
        "def f():\n    global x\n    def g():\n        x: int = 1\nprint('ok')\n",
      ],
      ["a repeated keyword argument", "print('before')\nf(x=1, x=2)\n"],
      ["a repeated keyword argument after a double star", "print('before')\nf(**a, x=1, x=2)\n"],
      [
        "a repeated keyword argument in a nested call",
        "print('before')\nprint(f(y=1, g(z=1, z=2)))\n",
      ],
      [
        "unary plus keeps the same float",
        "n = float('nan')\nprint([+n] == [n], +n in [n], [+(+n)] == [n])\n",
      ],
      ["unary minus makes a new float", "n = float('nan')\nprint([-n] == [n], -n in [n])\n"],
      ["unary plus of other numbers", "print(+1, +1.5, +True, +0.0, -0.0, +(-0.0))\n"],
    ])("%s", (_, code) => same(code));

    test.each([
      ["a global name annotated at module level", "global x\nx: int = 1\n"],
      ["distinct keyword arguments", "f(x=1, y=2)\n"],
    ])("%s is not a syntax error (the constructs are unsupported yet)", (_, code) => {
      expect(evaluate(code, 1000).error?.kind).not.toBe("SyntaxError");
    });
  },
);
