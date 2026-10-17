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
