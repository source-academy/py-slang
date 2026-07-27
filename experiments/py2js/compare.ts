/**
 * py2js experiment — differential conformance harness.
 *
 * Runs each chapter-1 program through the CSE machine (the reference,
 * src/runner.ts) and through py2js, and compares printed output. Error cases
 * count as agreeing when both engines raise; the error texts are shown so
 * discrepancies in *kind* can be eyeballed.
 *
 * Run with:  yarn tsx experiments/py2js/compare.ts
 */
import "./conductor-alias";
import { runCode, RunError } from "../../src/runner";
import { runPy2Js, runPy2JsDual } from "./index";

interface Case {
  name: string;
  code: string;
}

const cases: Case[] = [
  // --- literals, printing, floats ---
  { name: "print int", code: `print(42)` },
  { name: "print float", code: `print(2.0)` },
  { name: "print float third", code: `print(1 / 3)` },
  { name: "print big float", code: `print(1e30)` },
  { name: "print small float", code: `print(0.00001)` },
  { name: "print neg zero", code: `print(-0.0)` },
  { name: "print bool", code: `print(True)\nprint(False)` },
  { name: "print none", code: `print(None)` },
  { name: "print string", code: `print("hello world")` },
  { name: "print multiple args", code: `print(1, 2.5, "x", True)` },
  { name: "big int arithmetic", code: `print(2 ** 100)` },

  // --- arithmetic semantics ---
  { name: "int div is float", code: `print(4 / 2)` },
  { name: "floor div", code: `print(7 // 2)\nprint(-7 // 2)` },
  { name: "mod sign", code: `print(7 % 3)\nprint(-7 % 3)\nprint(7 % -3)` },
  { name: "mixed int float", code: `print(1 + 2.5)\nprint(2 * 3.0)` },
  { name: "power int", code: `print(2 ** 10)` },
  { name: "power neg exp", code: `print(2 ** -2)` },
  { name: "unary minus", code: `print(-5)\nprint(-2.5)\nprint(- - 3)` },
  { name: "string concat", code: `print("foo" + "bar")` },

  // --- comparisons ---
  { name: "int compare", code: `print(1 < 2)\nprint(2 <= 1)\nprint(3 > 2)\nprint(2 >= 3)` },
  { name: "cross int float compare", code: `print(1 == 1.0)\nprint(1 < 1.5)` },
  { name: "string compare", code: `print("a" < "b")\nprint("abc" == "abc")` },
  { name: "cross type equality", code: `print(1 == "1")\nprint(None == 1)` },
  { name: "none equality", code: `print(None == None)\nprint(None != None)` },
  { name: "chained compare", code: `print(1 < 2 < 3)\nprint(1 < 3 < 2)` },

  // --- booleans, conditionals ---
  { name: "and or not", code: `print(True and False)\nprint(True or False)\nprint(not True)` },
  {
    name: "short circuit",
    code: `def boom():\n    return 1 / 0\nprint(False and boom() == 1)\nprint(True or boom() == 1)`,
  },
  {
    name: "if elif else",
    code: `x = 7\nif x < 5:\n    print("small")\nelif x < 10:\n    print("medium")\nelse:\n    print("large")`,
  },
  { name: "ternary", code: `print("yes" if 1 < 2 else "no")` },

  // --- functions ---
  {
    name: "factorial",
    code: `def fact(n):\n    return 1 if n == 0 else n * fact(n - 1)\nprint(fact(20))`,
  },
  {
    name: "fib",
    code: `def fib(n):\n    return n if n < 2 else fib(n - 1) + fib(n - 2)\nprint(fib(15))`,
  },
  { name: "lambda", code: `square = lambda x: x * x\nprint(square(9))` },
  {
    name: "higher order",
    code: `def twice(f):\n    return lambda x: f(f(x))\nadd3 = twice(lambda x: x + 3)\nprint(add3(10))`,
  },
  {
    name: "closure capture",
    code: `def make_adder(n):\n    def add(x):\n        return x + n\n    return add\nprint(make_adder(5)(10))`,
  },
  { name: "no return is none", code: `def f():\n    pass\nprint(f())` },
  { name: "print returns none", code: `print(print(1))` },
  { name: "function repr", code: `def f():\n    return 1\nprint(f)` },
  {
    name: "deep tail recursion",
    code: `def count(n, acc):\n    return acc if n == 0 else count(n - 1, acc + n)\nprint(count(100000, 0))`,
  },
  {
    name: "mutual tail recursion",
    code: `def even(n):\n    return True if n == 0 else odd(n - 1)\ndef odd(n):\n    return False if n == 0 else even(n - 1)\nprint(even(50001))`,
  },

  // --- builtins ---
  { name: "abs", code: `print(abs(-5))\nprint(abs(2.5))` },
  { name: "max min", code: `print(max(3, 7))\nprint(min(3, 7))` },
  { name: "math_sqrt", code: `print(math_sqrt(2.0))` },
  { name: "math_pi", code: `print(math_pi)` },
  { name: "str builtin", code: `print(str(42) + "!")` },

  // --- error cases: both engines must raise ---
  { name: "err int plus str", code: `print(1 + "a")` },
  { name: "err bool equality", code: `print(True == 1)` },
  { name: "err bool ordering", code: `print(True < 2)` },
  { name: "truthy int condition", code: `if 1:\n    print("x")` },
  {
    name: "falsy conditions",
    code: `print("a" if 0 else "b")\nprint("c" if "" else "d")\nprint("e" if None else "f")\nprint("g" if 0.0 else "h")`,
  },
  { name: "err non-bool and", code: `print(1 and True)` },
  { name: "err not on int", code: `print(not 1)` },
  { name: "err div by zero", code: `print(1 / 0)` },
  { name: "err floor div by zero", code: `print(1 // 0)` },
  { name: "err mod by zero", code: `print(1 % 0)` },
  { name: "err call non-function", code: `x = 1\nx(2)` },
  { name: "err wrong arity", code: `def f(a, b):\n    return a\nf(1)` },
  { name: "err none arith", code: `print(None + 1)` },
  { name: "err minus on string", code: `print(-"a")` },
  { name: "err function equality", code: `def f():\n    return 1\nprint(f == f)` },
];

type Result = { ok: true; output: string } | { ok: false; error: string };

async function runCse(code: string): Promise<Result> {
  try {
    return { ok: true, output: await runCode(code, 1, { envSteps: 1_000_000_000 }) };
  } catch (e) {
    return { ok: false, error: e instanceof RunError ? `${e.kind}: ${e.message}` : String(e) };
  }
}

function runJs(code: string): Result {
  try {
    return { ok: true, output: runPy2Js(code).output };
  } catch (e) {
    return { ok: false, error: `${(e as Error).name}: ${(e as Error).message}` };
  }
}

async function runJsDual(code: string): Promise<Result> {
  try {
    return { ok: true, output: (await runPy2JsDual(code)).output };
  } catch (e) {
    return { ok: false, error: `${(e as Error).name}: ${(e as Error).message}` };
  }
}

async function main() {
  let pass = 0;
  const failures: string[] = [];
  for (const c of cases) {
    const cse = await runCse(c.code);
    const js = runJs(c.code);
    const dual = await runJsDual(c.code);
    const pairAgrees = (r: Result) => (cse.ok && r.ok ? cse.output === r.output : !cse.ok && !r.ok);
    const agree = pairAgrees(js) && pairAgrees(dual);
    if (agree) {
      pass++;
      const detail = cse.ok
        ? JSON.stringify((cse as { output: string }).output)
        : `all error (cse: ${(cse as { error: string }).error.split("\n")[0]} | py2js: ${(js as { error: string }).error})`;
      console.log(`PASS ${c.name.padEnd(28)} ${detail}`);
    } else {
      const show = (r: Result) =>
        r.ok ? `output ${JSON.stringify(r.output)}` : `error ${r.error.split("\n")[0]}`;
      failures.push(c.name);
      console.log(
        `FAIL ${c.name.padEnd(28)}\n     cse:        ${show(cse)}\n     py2js:      ${show(js)}\n     py2js dual: ${show(dual)}`,
      );
    }
  }
  console.log(`\n${pass}/${cases.length} cases agree with the CSE machine (sync AND dual compile)`);
  if (failures.length > 0) console.log(`Failures: ${failures.join(", ")}`);
}

main();
